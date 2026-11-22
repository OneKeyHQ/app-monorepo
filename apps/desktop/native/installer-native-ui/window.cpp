#include "window.h"

#include <commctrl.h>
#include <dwmapi.h>
#include <shellapi.h>
#include <windowsx.h>

#include <algorithm>
#include <cmath>
#include <exception>
#include <iterator>
#include <utility>

namespace installer {
namespace {

constexpr wchar_t kWindowClass[] = L"OneKey.NativeInstaller";
constexpr UINT kInvoke = WM_APP + 1;
constexpr UINT_PTR kAnimation = 1;

struct Operation {
  const std::function<void()>& run;
  std::exception_ptr error;
};

class DpiScope {
 public:
  DpiScope() {
    const auto method = GetProcAddress(GetModuleHandleW(L"user32.dll"),
                                       "SetThreadDpiAwarenessContext");
    if (method != nullptr) {
      set_ = reinterpret_cast<decltype(set_)>(method);
      previous_ = set_(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);
      if (previous_ == nullptr) {
        previous_ = set_(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE);
      }
    }
  }

  ~DpiScope() {
    if (previous_ != nullptr) {
      set_(previous_);
    }
  }

 private:
  DPI_AWARENESS_CONTEXT(WINAPI* set_)(DPI_AWARENESS_CONTEXT) = nullptr;
  DPI_AWARENESS_CONTEXT previous_ = nullptr;
};

bool IsButton(const Node& node) {
  return node.kind == Kind::button || node.kind == Kind::caption;
}

struct ProgressChild {
  HWND hwnd = nullptr;
  LONG width = 0;
};

BOOL CALLBACK FindProgressChild(HWND child, LPARAM parameter) {
  wchar_t class_name[64]{};
  if (!GetClassNameW(child, class_name, static_cast<int>(std::size(class_name))) ||
      _wcsicmp(class_name, PROGRESS_CLASSW) != 0) {
    return TRUE;
  }
  RECT bounds{};
  if (GetWindowRect(child, &bounds)) {
    auto& found = *reinterpret_cast<ProgressChild*>(parameter);
    const LONG width = bounds.right - bounds.left;
    if (width > found.width) {
      found = {child, width};
    }
  }
  return TRUE;
}

}  // namespace

Window::Surface::~Surface() { Reset(); }

bool Window::Surface::Ensure(HDC reference, LONG width, LONG height) {
  if (bitmap != nullptr && size.cx == width && size.cy == height) {
    return true;
  }
  if (dc == nullptr) {
    dc = CreateCompatibleDC(reference);
  }
  if (dc == nullptr) {
    return false;
  }
  const auto replacement = CreateCompatibleBitmap(reference, width, height);
  if (replacement == nullptr) {
    return false;
  }
  const auto previous = SelectObject(dc, replacement);
  if (previous == nullptr || previous == HGDI_ERROR) {
    DeleteObject(replacement);
    return false;
  }
  if (bitmap == nullptr) {
    initial_bitmap = previous;
  } else {
    DeleteObject(bitmap);
  }
  bitmap = replacement;
  size = {width, height};
  return true;
}

void Window::Surface::Reset() {
  if (dc != nullptr) {
    if (bitmap != nullptr) {
      SelectObject(dc, initial_bitmap);
      DeleteObject(bitmap);
    }
    DeleteDC(dc);
    dc = nullptr;
    bitmap = nullptr;
    initial_bitmap = nullptr;
    size = {};
  }
}

Window::Window(HINSTANCE module, std::wstring locale, std::wstring version)
    : module_(module), owner_thread_(GetCurrentThreadId()) {
  state_.locale = std::move(locale);
  state_.version = std::move(version);
}

Window::~Window() {
  if (class_registered_) {
    UnregisterClassW(kWindowClass, module_);
  }
  if (big_icon_ != nullptr) {
    DestroyIcon(big_icon_);
  }
  if (small_icon_ != nullptr) {
    DestroyIcon(small_icon_);
  }
  fonts_.clear();
  if (graphics_token_ != 0) {
    Gdiplus::GdiplusShutdown(graphics_token_);
  }
}

bool Window::Create(HWND host) {
  Gdiplus::GdiplusStartupInput config;
  if (Gdiplus::GdiplusStartup(&graphics_token_, &config, nullptr) != Gdiplus::Ok) {
    return false;
  }
  WNDCLASSEXW window_class{};
  window_class.cbSize = sizeof(window_class);
  window_class.lpfnWndProc = WindowProc;
  window_class.hInstance = module_;
  window_class.hCursor = LoadCursorW(nullptr, IDC_ARROW);
  window_class.lpszClassName = kWindowClass;
  class_registered_ = RegisterClassExW(&window_class) != 0;
  if (!class_registered_ || !SetPage(L"installing")) {
    return false;
  }

  const DpiScope dpi_scope;
  host_ = host;
  const HWND placement = IsWindow(host) ? host : GetForegroundWindow();
  const HMONITOR monitor = MonitorFromWindow(placement, MONITOR_DEFAULTTOPRIMARY);
  MONITORINFO monitor_info{};
  monitor_info.cbSize = sizeof(monitor_info);
  GetMonitorInfoW(monitor, &monitor_info);
  const auto& geometry = WindowGeometry();
  const auto hwnd = CreateWindowExW(WS_EX_APPWINDOW, kWindowClass, L"OneKey Setup",
                                    WS_POPUP | WS_SYSMENU | WS_MINIMIZEBOX,
                                    monitor_info.rcWork.left, monitor_info.rcWork.top,
                                    geometry.width, geometry.height,
                                    nullptr, nullptr, module_, this);
  if (hwnd == nullptr) {
    return false;
  }

  constexpr DWORD corner_preference = 33;
  constexpr DWORD round = 2;
  system_frame_ = SUCCEEDED(DwmSetWindowAttribute(hwnd, corner_preference, &round, sizeof(round)));
  if (system_frame_) {
    SetWindowLongPtrW(hwnd, GWL_STYLE, GetWindowLongPtrW(hwnd, GWL_STYLE) | WS_CAPTION | WS_THICKFRAME);
  }
  PlaceOnMonitor(monitor, GetDpiForWindow(hwnd));
  EnumResourceNamesW(GetModuleHandleW(nullptr), RT_GROUP_ICON, LoadHostIcons,
                     reinterpret_cast<LONG_PTR>(this));
  if (SetTimer(hwnd, kAnimation, 16, nullptr) == 0) {
    DestroyWindow(hwnd);
    return false;
  }
  return true;
}

BOOL CALLBACK Window::LoadHostIcons(HMODULE module, LPCWSTR, LPWSTR name, LONG_PTR context) {
  auto& window = *reinterpret_cast<Window*>(context);
  const HWND hwnd = window.hwnd_.load();
  const int dpi = static_cast<int>(GetDpiForWindow(hwnd));
  const int large = MulDiv(32, dpi, 96);
  const int small_size = MulDiv(16, dpi, 96);
  window.big_icon_ = static_cast<HICON>(LoadImageW(module, name, IMAGE_ICON, large, large, LR_DEFAULTCOLOR));
  window.small_icon_ = static_cast<HICON>(LoadImageW(module, name, IMAGE_ICON, small_size, small_size, LR_DEFAULTCOLOR));
  if (window.big_icon_ != nullptr) {
    SendMessageW(hwnd, WM_SETICON, ICON_BIG, reinterpret_cast<LPARAM>(window.big_icon_));
  }
  if (window.small_icon_ != nullptr) {
    SendMessageW(hwnd, WM_SETICON, ICON_SMALL, reinterpret_cast<LPARAM>(window.small_icon_));
  }
  return window.big_icon_ == nullptr && window.small_icon_ == nullptr;
}

bool Window::Invoke(const std::function<void()>& operation) {
  const auto hwnd = hwnd_.load();
  if (hwnd == nullptr) {
    return false;
  }
  if (GetCurrentThreadId() == owner_thread_) {
    operation();
    return true;
  }
  // NSIS may issue a call from its section worker while the GUI thread handles input.
  Operation invocation{operation, {}};
  const auto result = SendMessageW(hwnd, kInvoke, 0, reinterpret_cast<LPARAM>(&invocation));
  if (invocation.error) {
    std::rethrow_exception(invocation.error);
  }
  return result != 0;
}

void Window::Show() {
  const auto hwnd = hwnd_.load();
  ShowWindow(hwnd, IsIconic(hwnd) ? SW_RESTORE : SW_SHOW);
  SetForegroundWindow(hwnd);
  SetFocus(hwnd);
  UpdateWindow(hwnd);
}

void Window::Hide() { ShowWindow(hwnd_.load(), SW_HIDE); }

void Window::Destroy() { DestroyWindow(hwnd_.load()); }

void Window::BindHost(HWND host) { host_ = host; }

bool Window::SetPage(std::wstring_view page) {
  const auto* definition = FindPage(page);
  if (definition == nullptr) {
    return false;
  }
  if (page_name_ == page || event_ == L"cancel" || event_ == L"closed") {
    return true;
  }
  auto fonts = CreateFonts(*definition, state_.locale);
  page_name_.assign(page);
  page_ = definition;
  fonts_ = std::move(fonts);
  event_ = {};
  state_.cancellation_locked = false;
  state_.display_progress = static_cast<float>(state_.progress);
  cancel_forwarded_ = false;
  cancel_requested_at_ = 0;
  input_ = {};
  Rebuild();
  return true;
}

void Window::SetProgress(int progress, bool reset) {
  if (reset) {
    state_.progress = progress;
    state_.display_progress = static_cast<float>(progress);
    state_.shimmer = -0.35F;
  } else {
    state_.progress = std::max(state_.progress, progress);
  }
  manual_progress_ = !reset;
  RedrawProgress(true);
}

void Window::SetDirectory(std::wstring directory, std::wstring_view scope) {
  if (scope == L"current") {
    state_.per_user_directory = std::move(directory);
    if (page_name_ == L"welcome" && !state_.machine_scope) {
      state_.install_directory = state_.per_user_directory;
    }
  } else if (scope == L"all") {
    state_.per_machine_directory = std::move(directory);
    if (page_name_ == L"welcome" && state_.machine_scope) {
      state_.install_directory = state_.per_machine_directory;
    }
  } else {
    state_.install_directory = std::move(directory);
  }
  Redraw();
}

void Window::SetStatus(std::wstring status) {
  state_.status = std::move(status);
  Redraw();
}

void Window::SetVersion(std::wstring version) {
  state_.version = std::move(version);
  Redraw();
}

std::wstring_view Window::Event(bool wait) {
  last_poll_at_ = GetTickCount64();
  MSG message{};
  if (wait) {
    while (event_.empty() && hwnd_.load() != nullptr) {
      const int result = GetMessageW(&message, nullptr, 0, 0);
      if (result <= 0) {
        if (result == 0) {
          PostQuitMessage(static_cast<int>(message.wParam));
        }
        return L"closed";
      }
      TranslateMessage(&message);
      DispatchMessageW(&message);
    }
  }
  if (event_.empty()) {
    return hwnd_.load() == nullptr ? L"closed" : L"none";
  }
  const auto result = event_;
  if (result != L"cancel" && result != L"closed") {
    event_ = {};
  }
  return result;
}

std::wstring_view Window::PrepareCommit() {
  last_poll_at_ = GetTickCount64();
  if (event_ == L"cancel" || event_ == L"closed") {
    return L"cancel";
  }
  if (page_name_ == L"confirmExit") {
    return L"pending";
  }
  state_.cancellation_locked = true;
  if (!Enabled(input_.focused)) {
    input_.focused = {};
  }
  Redraw();
  return L"ok";
}

void Window::PlaceOnMonitor(HMONITOR monitor, UINT dpi) {
  MONITORINFO info{};
  info.cbSize = sizeof(info);
  if (!GetMonitorInfoW(monitor, &info)) {
    return;
  }
  const auto& geometry = WindowGeometry();
  const auto& work = info.rcWork;
  const int work_width = work.right - work.left;
  const int work_height = work.bottom - work.top;
  scale_ = std::min({static_cast<float>(dpi == 0 ? 96 : dpi) / 96,
                     static_cast<float>(work_width) / geometry.width,
                     static_cast<float>(work_height) / geometry.height});
  const long width = std::lround(geometry.width * scale_);
  const long height = std::lround(geometry.height * scale_);
  const long x = work.left + (work_width - width) / 2;
  const long y = work.top + (work_height - height) / 2;
  const auto hwnd = hwnd_.load();
  SetWindowPos(hwnd, nullptr, x, y, width, height,
               SWP_NOZORDER | SWP_NOACTIVATE | SWP_FRAMECHANGED);
  if (!system_frame_) {
    const auto diameter = std::lround(geometry.radius * scale_);
    const HRGN region = CreateRoundRectRgn(0, 0, width + 1, height + 1, diameter, diameter);
    if (region != nullptr && SetWindowRgn(hwnd, region, TRUE) == 0) {
      DeleteObject(region);
    }
  }
  Redraw();
}

void Window::Rebuild() {
  elements_ = Layout(*page_, state_);
  legal_bounds_ = {};
  tab_order_.clear();
  for (const auto& element : elements_) {
    if (IsButton(*element.node)) {
      tab_order_.push_back(element.node->Attribute(L"name"));
    } else if (element.node->kind == Kind::legal) {
      tab_order_.insert(tab_order_.end(), kLegalLinks.begin(), kLegalLinks.end());
    }
  }
  Redraw();
}

void Window::Redraw() {
  background_dirty_ = true;
  const auto hwnd = hwnd_.load();
  if (hwnd != nullptr) {
    InvalidateRect(hwnd, nullptr, FALSE);
  }
}

void Window::RedrawProgress(bool include_label) {
  const auto hwnd = hwnd_.load();
  if (hwnd == nullptr) {
    return;
  }
  for (const auto& element : elements_) {
    if (element.node->kind == Kind::progress ||
        (include_label && element.node->Attribute(L"name") == L"progress-value")) {
      const auto& bounds = element.bounds;
      const RECT dirty{
          static_cast<LONG>(std::floor(bounds.X * scale_)),
          static_cast<LONG>(std::floor(bounds.Y * scale_)),
          static_cast<LONG>(std::ceil(bounds.GetRight() * scale_)),
          static_cast<LONG>(std::ceil(bounds.GetBottom() * scale_))};
      InvalidateRect(hwnd, &dirty, FALSE);
    }
  }
}

void Window::Draw(HDC dc, const RECT& dirty) {
  RECT client{};
  GetClientRect(hwnd_.load(), &client);
  if (client.right <= 0 || client.bottom <= 0) {
    return;
  }

  if (client.right != background_.size.cx || client.bottom != background_.size.cy) {
    background_dirty_ = true;
  }
  const bool buffered = background_.Ensure(dc, client.right, client.bottom) &&
                        frame_.Ensure(dc, client.right, client.bottom);
  if (background_dirty_ || !buffered) {
    Gdiplus::Graphics canvas(buffered ? background_.dc : dc);
    canvas.SetPageUnit(Gdiplus::UnitPixel);
    canvas.ScaleTransform(scale_, scale_);
    auto paint_input = input_;
    if (GetFocus() != hwnd_.load() || !keyboard_focus_) {
      paint_input.focused = {};
    }
    Paint(canvas, elements_, fonts_, state_, page_name_ == L"welcome", paint_input, legal_bounds_);
    background_dirty_ = !buffered;
  }
  const int width = dirty.right - dirty.left;
  const int height = dirty.bottom - dirty.top;
  if (buffered) {
    BitBlt(frame_.dc, dirty.left, dirty.top, width, height,
           background_.dc, dirty.left, dirty.top, SRCCOPY);
  }
  if (page_name_ == L"installing" || page_name_ == L"uninstalling") {
    Gdiplus::Graphics canvas(buffered ? frame_.dc : dc);
    canvas.SetPageUnit(Gdiplus::UnitPixel);
    canvas.ScaleTransform(scale_, scale_);
    canvas.SetClip(Gdiplus::RectF(dirty.left / scale_, dirty.top / scale_,
                                  width / scale_, height / scale_));
    PaintProgress(canvas, elements_, fonts_, state_);
  }
  if (buffered) {
    BitBlt(dc, dirty.left, dirty.top, width, height,
           frame_.dc, dirty.left, dirty.top, SRCCOPY);
  }
}

void Window::OnAnimation() {
  const auto now = GetTickCount64();
  const bool operation_page = page_name_ == L"installing" || page_name_ == L"uninstalling";
  if ((operation_page || page_name_ == L"confirmExit") && IsWindow(host_) &&
      now >= next_native_progress_at_) {
    next_native_progress_at_ = now + 80;
    if ((event_ == L"cancel" || event_ == L"closed") && !cancel_forwarded_ &&
        now - last_poll_at_ > 250) {
      if (cancel_requested_at_ == 0) {
        cancel_requested_at_ = now;
      } else if (now - cancel_requested_at_ >= 160) {
        PostMessageW(host_, WM_COMMAND, IDCANCEL, 0);
        cancel_forwarded_ = true;
      }
    }
    if (operation_page && !manual_progress_ && event_.empty()) {
      ProgressChild progress;
      EnumChildWindows(host_, FindProgressChild, reinterpret_cast<LPARAM>(&progress));
      if (progress.hwnd != nullptr) {
        const auto low = SendMessageW(progress.hwnd, PBM_GETRANGE, TRUE, 0);
        const auto high = SendMessageW(progress.hwnd, PBM_GETRANGE, FALSE, 0);
        const auto position = SendMessageW(progress.hwnd, PBM_GETPOS, 0, 0);
        if (high > low) {
          const auto percent = static_cast<int>(std::clamp<LRESULT>((position - low) * 100 / (high - low), 0, 100));
          if (percent > state_.progress) {
            state_.progress = percent;
            RedrawProgress(true);
          }
        }
      }
    }
  }
  const auto hwnd = hwnd_.load();
  if (!operation_page || !IsWindowVisible(hwnd) || IsIconic(hwnd) || !event_.empty()) {
    return;
  }
  const float difference = static_cast<float>(state_.progress) - state_.display_progress;
  state_.display_progress = std::abs(difference) < 0.08F
      ? static_cast<float>(state_.progress) : state_.display_progress + difference * 0.18F;
  if (state_.display_progress > 0 || difference != 0) {
    state_.shimmer += 0.018F;
    if (state_.shimmer > 1.35F) {
      state_.shimmer = -0.35F;
    }
    RedrawProgress(false);
  }
}

bool Window::Enabled(std::wstring_view target) const {
  if (event_ == L"cancel" || event_ == L"closed") {
    return target == L"minbtn";
  }
  return !(state_.cancellation_locked && (target == L"cancel" || target == L"closebtn"));
}

std::wstring_view Window::HitTest(LPARAM coordinates) const {
  const auto x = GET_X_LPARAM(coordinates) / scale_;
  const auto y = GET_Y_LPARAM(coordinates) / scale_;
  for (auto element = elements_.rbegin(); element != elements_.rend(); ++element) {
    if (IsButton(*element->node) && element->bounds.Contains(x, y)) {
      const auto target = element->node->Attribute(L"name");
      return Enabled(target) ? target : std::wstring_view{};
    }
  }
  for (std::size_t i = 0; i < legal_bounds_.size(); ++i) {
    if (legal_bounds_[i].Contains(x, y)) {
      return kLegalLinks[i];
    }
  }
  return {};
}

void Window::OnClose(bool cancel_button) {
  if (state_.cancellation_locked || event_ == L"cancel" || event_ == L"closed") {
    return;
  }
  if (page_name_ == L"installing") {
    SetPage(L"confirmExit");
  } else if (page_name_ == L"confirmExit") {
    SetPage(L"installing");
  } else {
    event_ = cancel_button ? L"cancel" : L"closed";
    if (page_name_ != L"uninstalling") {
      Hide();
    }
  }
}

void Window::Activate(std::wstring_view target) {
  if (!Enabled(target)) {
    return;
  }
  const bool welcome = page_name_ == L"welcome";
  if (target == L"minbtn") {
    ShowWindow(hwnd_.load(), SW_MINIMIZE);
  } else if (target == L"closebtn" || target == L"cancel") {
    OnClose(target == L"cancel");
  } else if (target == L"exit-stay") {
    SetPage(L"installing");
  } else if (target == L"exit-confirm") {
    event_ = L"cancel";
  } else if (target == L"primary") {
    event_ = !welcome ? L"primary" : state_.machine_scope ? L"primary-all" : L"primary-current";
    if (page_name_ == L"finish" || page_name_ == L"uninstallFinish") {
      Hide();
    }
  } else if (target == L"browse") {
    event_ = !welcome ? L"browse" : state_.machine_scope ? L"browse-all" : L"browse-current";
  } else if (target == L"more-options") {
    state_.advanced_options = !state_.advanced_options;
    state_.options_visited = true;
    Rebuild();
  } else if (target == L"scope-current" || target == L"scope-all") {
    if (welcome) {
      state_.machine_scope = target == L"scope-all";
      state_.install_directory = state_.machine_scope ? state_.per_machine_directory : state_.per_user_directory;
      Redraw();
    } else {
      event_ = target;
    }
  } else if (target == L"terms" || target == L"privacy") {
    const auto url = target == L"terms" ? L"https://help.onekey.so/articles/11461297"
                                       : L"https://help.onekey.so/articles/11461298";
    ShellExecuteW(hwnd_.load(), L"open", url, nullptr, nullptr, SW_SHOWNORMAL);
  }
}

void Window::FocusNext(bool reverse) {
  std::vector<std::wstring_view> enabled;
  for (const auto target : tab_order_) {
    if (!target.empty() && Enabled(target)) {
      enabled.push_back(target);
    }
  }
  if (enabled.empty()) {
    return;
  }
  const auto current = std::find(enabled.begin(), enabled.end(), input_.focused);
  if (current == enabled.end()) {
    input_.focused = reverse ? enabled.back() : enabled.front();
  } else if (reverse) {
    input_.focused = current == enabled.begin() ? enabled.back() : *std::prev(current);
  } else {
    const auto next = std::next(current);
    input_.focused = next == enabled.end() ? enabled.front() : *next;
  }
  keyboard_focus_ = true;
  Redraw();
}

LRESULT CALLBACK Window::WindowProc(HWND hwnd, UINT message, WPARAM wparam, LPARAM lparam) {
  auto* self = reinterpret_cast<Window*>(GetWindowLongPtrW(hwnd, GWLP_USERDATA));
  if (message == WM_NCCREATE) {
    self = static_cast<Window*>(reinterpret_cast<CREATESTRUCTW*>(lparam)->lpCreateParams);
    SetWindowLongPtrW(hwnd, GWLP_USERDATA, reinterpret_cast<LONG_PTR>(self));
    self->hwnd_.store(hwnd);
  }
  if (self == nullptr) {
    return DefWindowProcW(hwnd, message, wparam, lparam);
  }
  try {
    return self->Handle(hwnd, message, wparam, lparam);
  } catch (...) {
    self->event_ = L"closed";
    self->Hide();
    return 0;
  }
}

LRESULT Window::Handle(HWND hwnd, UINT message, WPARAM wparam, LPARAM lparam) {
  switch (message) {
    case kInvoke: {
      auto& operation = *reinterpret_cast<Operation*>(lparam);
      try {
        operation.run();
      } catch (...) {
        operation.error = std::current_exception();
      }
      return 1;
    }
    case WM_NCCALCSIZE:
      return 0;
    case WM_NCDESTROY:
      KillTimer(hwnd, kAnimation);
      background_.Reset();
      frame_.Reset();
      SetWindowLongPtrW(hwnd, GWLP_USERDATA, 0);
      hwnd_.store(nullptr);
      break;
    case WM_NCHITTEST: {
      POINT point{GET_X_LPARAM(lparam), GET_Y_LPARAM(lparam)};
      ScreenToClient(hwnd, &point);
      if (point.y >= 0 && point.y < page_->caption_height * scale_ &&
          point.x < (WindowGeometry().width - 102) * scale_) {
        return HTCAPTION;
      }
      return HTCLIENT;
    }
    case WM_NCLBUTTONDBLCLK:
      return 0;
    case WM_SYSCOMMAND:
      if ((wparam & 0xFFF0) == SC_MAXIMIZE || (wparam & 0xFFF0) == SC_SIZE) {
        return 0;
      }
      break;
    case WM_DPICHANGED: {
      const auto* suggested = reinterpret_cast<const RECT*>(lparam);
      PlaceOnMonitor(MonitorFromRect(suggested, MONITOR_DEFAULTTONEAREST), HIWORD(wparam));
      return 0;
    }
    case WM_ERASEBKGND:
      return 1;
    case WM_PAINT: {
      PAINTSTRUCT paint{};
      const auto dc = BeginPaint(hwnd, &paint);
      try {
        Draw(dc, paint.rcPaint);
      } catch (...) {
        EndPaint(hwnd, &paint);
        throw;
      }
      EndPaint(hwnd, &paint);
      return 0;
    }
    case WM_PRINTCLIENT: {
      RECT client{};
      GetClientRect(hwnd, &client);
      Draw(reinterpret_cast<HDC>(wparam), client);
      return 0;
    }
    case WM_TIMER:
      if (wparam == kAnimation) {
        OnAnimation();
        return 0;
      }
      break;
    case WM_CLOSE:
      OnClose(false);
      return 0;
    case WM_MOUSEMOVE: {
      if (!tracking_mouse_) {
        TRACKMOUSEEVENT request{sizeof(request), TME_LEAVE, hwnd, 0};
        tracking_mouse_ = TrackMouseEvent(&request) != FALSE;
      }
      const auto hovered = HitTest(lparam);
      if (hovered != input_.hovered) {
        input_.hovered = hovered;
        Redraw();
      }
      return 0;
    }
    case WM_MOUSELEAVE:
      tracking_mouse_ = false;
      input_.hovered = {};
      Redraw();
      return 0;
    case WM_SETCURSOR:
      if (LOWORD(lparam) == HTCLIENT) {
        POINT point{};
        GetCursorPos(&point);
        ScreenToClient(hwnd, &point);
        const auto target = HitTest(MAKELPARAM(point.x, point.y));
        SetCursor(LoadCursorW(nullptr, target.empty() ? IDC_ARROW : IDC_HAND));
        return TRUE;
      }
      break;
    case WM_LBUTTONDOWN:
      input_.pressed = HitTest(lparam);
      if (!input_.pressed.empty()) {
        keyboard_focus_ = false;
        input_.focused = input_.pressed;
        input_.hovered = input_.pressed;
        SetCapture(hwnd);
        Redraw();
      }
      return 0;
    case WM_CAPTURECHANGED:
      input_.pressed = {};
      Redraw();
      return 0;
    case WM_LBUTTONUP: {
      const auto pressed = std::exchange(input_.pressed, {});
      if (GetCapture() == hwnd) {
        ReleaseCapture();
      }
      if (!pressed.empty() && pressed == HitTest(lparam)) {
        Activate(pressed);
      }
      Redraw();
      return 0;
    }
    case WM_KILLFOCUS:
    case WM_SETFOCUS:
      Redraw();
      return 0;
    case WM_KEYDOWN:
      if (wparam == VK_TAB) {
        FocusNext((GetKeyState(VK_SHIFT) & 0x8000) != 0);
        return 0;
      }
      if (wparam == VK_ESCAPE && (lparam & (1L << 30)) == 0) {
        OnClose(true);
        return 0;
      }
      if (wparam == VK_RETURN && (lparam & (1L << 30)) == 0) {
        if (!input_.focused.empty()) {
          Activate(input_.focused);
        } else if (page_name_ == L"confirmExit") {
          Activate(L"exit-stay");
        } else if (std::find(tab_order_.begin(), tab_order_.end(), L"primary") != tab_order_.end()) {
          Activate(L"primary");
        }
        return 0;
      }
      break;
    case WM_KEYUP:
      if (wparam == VK_SPACE && !input_.focused.empty()) {
        Activate(input_.focused);
        return 0;
      }
      break;
    default:
      break;
  }
  return DefWindowProcW(hwnd, message, wparam, lparam);
}

}  // namespace installer
