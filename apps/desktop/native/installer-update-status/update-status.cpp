#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#include <windows.h>

#include <algorithm>
#include <atomic>
#include <cwchar>
#include <iterator>
#include <memory>
#include <new>

#pragma comment(linker, "/EXPORT:Start=_Start")
#pragma comment(linker, "/EXPORT:ShowOneKeyUpdateStatusW=_ShowOneKeyUpdateStatusW@16")

namespace {

constexpr wchar_t kWindowClass[] = L"OneKeyInstallerUpdateStatus";
constexpr wchar_t kCaption[] = L"OneKey";
constexpr int kIconResource = 101;
constexpr UINT_PTR kProgressTimer = 1;

struct Locale {
  const wchar_t* tag;
  LANGID language;
  const wchar_t* title;
  const wchar_t* font = L"Segoe UI";
};

constexpr Locale kLocales[] = {
    {L"en-US", 9, L"Updating OneKey…"},
    {L"bn", 69, L"OneKey আপডেট হচ্ছে…", L"Nirmala UI"},
    {L"de", 7, L"OneKey wird aktualisiert…"},
    {L"es", 10, L"Actualizando OneKey…"},
    {L"fr-FR", 12, L"Mise à jour de OneKey…"},
    {L"hi-IN", 57, L"OneKey अपडेट हो रहा है…", L"Nirmala UI"},
    {L"id", 33, L"Memperbarui OneKey…"},
    {L"it-IT", 16, L"Aggiornamento di OneKey…"},
    {L"ja-JP", 17, L"OneKeyを更新しています…", L"Yu Gothic UI"},
    {L"ko-KR", 18, L"OneKey 업데이트 중…", L"Malgun Gothic"},
    {L"pt", 22, L"A atualizar o OneKey…"},
    {L"pt-BR", 1046, L"Atualizando o OneKey…"},
    {L"ru", 25, L"Обновление OneKey…"},
    {L"th-TH", 30, L"กำลังอัปเดต OneKey…", L"Leelawadee UI"},
    {L"uk-UA", 34, L"Оновлення OneKey…"},
    {L"vi", 42, L"Đang cập nhật OneKey…"},
    {L"zh-CN", 4, L"正在更新 OneKey…", L"Microsoft YaHei UI"},
    {L"zh-HK", 3076, L"正在更新 OneKey…", L"Microsoft JhengHei UI"},
    {L"zh-TW", 1028, L"正在更新 OneKey…", L"Microsoft JhengHei UI"},
};

size_t SelectLocale(const wchar_t* tag) {
  const LANGID ui_language = GetUserDefaultUILanguage();
  const LANGID language = ui_language == 5124 ? 1028 : ui_language;
  size_t fallback = 0;
  for (size_t index = 0; index < std::size(kLocales); ++index) {
    const auto& locale = kLocales[index];
    if (tag && _wcsicmp(tag, locale.tag) == 0) {
      return index;
    }
    if (locale.language == language || locale.language == PRIMARYLANGID(language)) {
      fallback = index;
    }
  }
  return fallback;
}

// NSIS Unicode plug-in ABI. The installer owns the incoming GlobalAlloc stack.
struct NsisStackItem {
  NsisStackItem* next;
  wchar_t text[1];
};

using NsisCallback = UINT_PTR(__cdecl*)(int);

struct NsisExtraParameters {
  void* flags;
  int(WINAPI* execute)(int, HWND);
  void(WINAPI* validate_path)(wchar_t*);
  int(WINAPI* register_callback)(HMODULE, NsisCallback);
};

constexpr int kNsisUnload = 0;
constexpr DWORD kCleanupTimeoutMs = 200;
HANDLE g_installer_job = nullptr;
HANDLE g_launch_worker = nullptr;
std::atomic<HANDLE> g_status_process{nullptr};

struct Launch {
  HMODULE module;
  HANDLE job = nullptr;
  wchar_t system[MAX_PATH]{};
  wchar_t program[MAX_PATH]{};
  wchar_t command[MAX_PATH * 2 + 80]{};
};

HANDLE StartStatusHost(Launch& launch) {
  SIZE_T bytes = 0;
  InitializeProcThreadAttributeList(nullptr, 1, 0, &bytes);
  if (!bytes) {
    return nullptr;
  }

  auto* attributes = static_cast<LPPROC_THREAD_ATTRIBUTE_LIST>(
      HeapAlloc(GetProcessHeap(), 0, bytes));
  if (!attributes) {
    return nullptr;
  }

  HANDLE host = nullptr;
  if (InitializeProcThreadAttributeList(attributes, 1, 0, &bytes)) {
    // The host is in the job from its first instruction, including if NSIS
    // exits during CreateProcessW or the host stalls before displaying UI.
    if (UpdateProcThreadAttribute(attributes, 0, PROC_THREAD_ATTRIBUTE_JOB_LIST,
                                  &launch.job, sizeof(launch.job), nullptr, nullptr)) {
      STARTUPINFOEXW startup{};
      startup.StartupInfo.cb = sizeof(startup);
      startup.lpAttributeList = attributes;
      PROCESS_INFORMATION process{};
      if (CreateProcessW(launch.program, launch.command, nullptr, nullptr,
                         FALSE, EXTENDED_STARTUPINFO_PRESENT | CREATE_DEFAULT_ERROR_MODE,
                         nullptr, launch.system, &startup.StartupInfo, &process)) {
        CloseHandle(process.hThread);
        host = process.hProcess;
      }
    }
    DeleteProcThreadAttributeList(attributes);
  }
  HeapFree(GetProcessHeap(), 0, attributes);
  return host;
}

DWORD WINAPI LaunchWorker(void* data) {
  const auto launch = static_cast<Launch*>(data);
  const HMODULE module = launch->module;
  const HANDLE host = StartStatusHost(*launch);
  HANDLE expected = nullptr;
  if (host && !g_status_process.compare_exchange_strong(expected, host)) {
    CloseHandle(host);
  }
  CloseHandle(launch->job);
  delete launch;
  FreeLibraryAndExitThread(module, 0);
}

UINT_PTR __cdecl OnNsisMessage(int message) {
  if (message == kNsisUnload && g_installer_job) {
    // Shut down the host before NSIS removes the plug-in directory. The job
    // handle's lifetime also covers process termination without this callback.
    TerminateJobObject(g_installer_job, 0);
    CloseHandle(g_installer_job);
    g_installer_job = nullptr;
    const ULONGLONG deadline = GetTickCount64() + kCleanupTimeoutMs;
    WaitForSingleObject(g_launch_worker, kCleanupTimeoutMs);
    CloseHandle(g_launch_worker);
    g_launch_worker = nullptr;
    const HANDLE host = g_status_process.exchange(INVALID_HANDLE_VALUE);
    if (host) {
      // The host may still have the DLL mapped as NSIS starts file cleanup.
      // Keep worker and host cleanup within the same bounded wait.
      const ULONGLONG now = GetTickCount64();
      WaitForSingleObject(host, now < deadline ? static_cast<DWORD>(deadline - now) : 0);
      CloseHandle(host);
    }
  }
  return 0;
}

void StartStatus(size_t locale, NsisExtraParameters& nsis) {
  if (g_installer_job || !nsis.register_callback) {
    return;
  }

  HMODULE module = nullptr;
  if (!GetModuleHandleExW(GET_MODULE_HANDLE_EX_FLAG_FROM_ADDRESS,
                         reinterpret_cast<LPCWSTR>(&LaunchWorker), &module)) {
    return;
  }

  auto launch = std::unique_ptr<Launch>(new (std::nothrow) Launch{module});
  wchar_t dll[MAX_PATH]{};
  const DWORD dll_length = GetModuleFileNameW(module, dll, std::size(dll));
  if (!launch || !dll_length || dll_length >= std::size(dll)) {
    FreeLibrary(module);
    return;
  }

  // Select the OS's x86 host explicitly on x64 and ARM64. Its working
  // directory must stay outside the installation tree during replacement.
  UINT system_length = GetSystemWow64DirectoryW(launch->system, std::size(launch->system));
  if (!system_length) {
    system_length = GetSystemDirectoryW(launch->system, std::size(launch->system));
  }
  if (!system_length || system_length >= std::size(launch->system) ||
      swprintf_s(launch->program, L"%ls\\rundll32.exe", launch->system) < 0 ||
      swprintf_s(launch->command, L"\"%ls\" \"%ls\",ShowOneKeyUpdateStatus %zu",
                 launch->program, dll, locale) < 0) {
    FreeLibrary(module);
    return;
  }

  const HANDLE job = CreateJobObjectW(nullptr, nullptr);
  if (!job) {
    FreeLibrary(module);
    return;
  }

  JOBOBJECT_EXTENDED_LIMIT_INFORMATION limits{};
  limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
  const HANDLE process = GetCurrentProcess();
  if (!SetInformationJobObject(job, JobObjectExtendedLimitInformation, &limits,
                               sizeof(limits)) ||
      !DuplicateHandle(process, job, process, &launch->job, 0, FALSE, DUPLICATE_SAME_ACCESS) ||
      nsis.register_callback(module, OnNsisMessage) < 0) {
    if (launch->job) {
      CloseHandle(launch->job);
    }
    CloseHandle(job);
    FreeLibrary(module);
    return;
  }

  // CreateProcessW can be delayed by security software. NSIS continues
  // without waiting for process startup or for an acknowledgement from UI.
  Launch* work = launch.release();
  const HANDLE thread = CreateThread(nullptr, 0, LaunchWorker, work, 0, nullptr);
  if (!thread) {
    CloseHandle(work->job);
    delete work;
    CloseHandle(job);
    FreeLibrary(module);
    return;
  }
  g_installer_job = job;
  g_launch_worker = thread;
}

struct Window {
  UINT dpi = USER_DEFAULT_SCREEN_DPI;
  HICON icon = nullptr;
  HFONT font = nullptr;
  bool high_contrast = false;
  bool animate = false;
  unsigned step = 0;

  ~Window() {
    if (icon) {
      DestroyIcon(icon);
    }
    if (font) {
      DeleteObject(font);
    }
  }

  int Scale(int value) const {
    return MulDiv(value, static_cast<int>(dpi), USER_DEFAULT_SCREEN_DPI);
  }
};

RECT ProgressRect(HWND hwnd, const Window& window) {
  RECT rect{};
  GetClientRect(hwnd, &rect);
  return {window.Scale(20), rect.bottom - window.Scale(22),
          rect.right - window.Scale(20), rect.bottom - window.Scale(18)};
}

void Paint(HWND hwnd, const Window& window) {
  PAINTSTRUCT paint{};
  const HDC dc = BeginPaint(hwnd, &paint);
  FillRect(dc, &paint.rcPaint, GetSysColorBrush(COLOR_WINDOW));
  if (window.icon) {
    DrawIconEx(dc, window.Scale(20), window.Scale(18), window.icon,
               window.Scale(32), window.Scale(32), 0, nullptr, DI_NORMAL);
  }
  auto progress = ProgressRect(hwnd, window);
  SetDCBrushColor(dc, window.high_contrast ? GetSysColor(COLOR_GRAYTEXT) : RGB(232, 238, 235));
  const auto brush = static_cast<HBRUSH>(GetStockObject(DC_BRUSH));
  FillRect(dc, &progress, brush);

  if (window.animate) {
    const LONG width = (progress.right - progress.left) / 4;
    const LONG position = window.step <= 100 ? window.step : 200 - window.step;
    progress.left += position * (progress.right - progress.left - width) / 100;
    progress.right = progress.left + width;
    SetDCBrushColor(dc, window.high_contrast ? GetSysColor(COLOR_HIGHLIGHT) : RGB(59, 207, 99));
    FillRect(dc, &progress, brush);
  }
  EndPaint(hwnd, &paint);
}

LRESULT CALLBACK WindowProcedure(HWND hwnd, UINT message, WPARAM wparam, LPARAM lparam) {
  if (message == WM_NCCREATE) {
    const auto* create = reinterpret_cast<CREATESTRUCTW*>(lparam);
    SetWindowLongPtrW(hwnd, GWLP_USERDATA, reinterpret_cast<LONG_PTR>(create->lpCreateParams));
  }
  auto* window = reinterpret_cast<Window*>(GetWindowLongPtrW(hwnd, GWLP_USERDATA));
  if (!window) {
    return DefWindowProcW(hwnd, message, wparam, lparam);
  }

  switch (message) {
    case WM_PAINT:
      Paint(hwnd, *window);
      return 0;
    case WM_CTLCOLORSTATIC: {
      const auto dc = reinterpret_cast<HDC>(wparam);
      SetTextColor(dc, window->high_contrast ? GetSysColor(COLOR_WINDOWTEXT) : RGB(21, 25, 24));
      SetBkColor(dc, GetSysColor(COLOR_WINDOW));
      return reinterpret_cast<LRESULT>(GetSysColorBrush(COLOR_WINDOW));
    }
    case WM_MOUSEACTIVATE:
      return MA_NOACTIVATEANDEAT;
    case WM_TIMER:
      window->step = (window->step + 4) % 200;
      {
        const RECT progress = ProgressRect(hwnd, *window);
        InvalidateRect(hwnd, &progress, FALSE);
      }
      return 0;
    case WM_DESTROY:
      KillTimer(hwnd, kProgressTimer);
      PostQuitMessage(0);
      return 0;
    default:
      return DefWindowProcW(hwnd, message, wparam, lparam);
  }
}

void RunWindow(HINSTANCE instance, const Locale& locale) {
  if (!SetThreadDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2)) {
    SetThreadDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE);
  }
  const WNDCLASSW window_class = {0, WindowProcedure, 0, 0, instance, nullptr,
                                 LoadCursorW(nullptr, IDC_ARROW), nullptr, nullptr, kWindowClass};
  if (!RegisterClassW(&window_class)) {
    return;
  }

  POINT cursor{};
  GetCursorPos(&cursor);
  MONITORINFO monitor{};
  monitor.cbSize = sizeof(monitor);
  if (!GetMonitorInfoW(MonitorFromPoint(cursor, MONITOR_DEFAULTTOPRIMARY), &monitor)) {
    return;
  }
  const RECT work = monitor.rcWork;

  Window window;
  const HWND hwnd = CreateWindowExW(WS_EX_NOACTIVATE | WS_EX_TOOLWINDOW, kWindowClass,
                                    kCaption, WS_POPUP | WS_BORDER | WS_CLIPCHILDREN,
                                    work.left, work.top, 0, 0, nullptr, nullptr,
                                    instance, &window);
  if (!hwnd) {
    return;
  }

  window.dpi = GetDpiForWindow(hwnd);
  window.icon = static_cast<HICON>(
      LoadImageW(instance, MAKEINTRESOURCEW(kIconResource), IMAGE_ICON,
                 window.Scale(32), window.Scale(32), LR_DEFAULTCOLOR));
  HIGHCONTRASTW contrast{};
  contrast.cbSize = sizeof(contrast);
  window.high_contrast = SystemParametersInfoW(SPI_GETHIGHCONTRAST, sizeof(contrast),
                                               &contrast, 0) &&
                         (contrast.dwFlags & HCF_HIGHCONTRASTON);
  BOOL animate = TRUE;
  SystemParametersInfoW(SPI_GETCLIENTAREAANIMATION, 0, &animate, 0);

  window.font = CreateFontW(-window.Scale(17), 0, 0, 0, FW_SEMIBOLD, FALSE, FALSE,
                            FALSE, DEFAULT_CHARSET, OUT_DEFAULT_PRECIS,
                            CLIP_DEFAULT_PRECIS, CLEARTYPE_QUALITY, DEFAULT_PITCH, locale.font);
  const int text_left = window.Scale(64);
  const int text_width = std::min(window.Scale(350), static_cast<int>(work.right - work.left) -
                                  text_left - window.Scale(36));
  RECT text{0, 0, text_width, 0};
  const HDC dc = GetDC(hwnd);
  if (dc) {
    const HGDIOBJ old_font = window.font ? SelectObject(dc, window.font) : nullptr;
    DrawTextW(dc, locale.title, -1, &text, DT_CALCRECT | DT_WORDBREAK | DT_NOPREFIX);
    if (old_font) {
      SelectObject(dc, old_font);
    }
    ReleaseDC(hwnd, dc);
  }
  const int text_height = static_cast<int>(text.bottom);
  const int height = std::max(window.Scale(78), text_height + window.Scale(52));
  const int width = std::max(window.Scale(300), text_left + static_cast<int>(text.right) +
                            window.Scale(22));
  const int content_top = window.Scale(12);
  const int content_bottom = height - window.Scale(22);
  const HWND label = CreateWindowExW(
      0, L"STATIC", locale.title, WS_VISIBLE | WS_CHILD | SS_NOPREFIX,
      text_left, (content_top + content_bottom - text_height) / 2,
      width - text_left - window.Scale(20), std::max(text_height, window.Scale(24)),
      hwnd, nullptr, instance, nullptr);
  if (label) {
    if (window.font) {
      SendMessageW(label, WM_SETFONT, reinterpret_cast<WPARAM>(window.font), FALSE);
    }
    window.animate = animate && SetTimer(hwnd, kProgressTimer, 45, nullptr) != 0;
    if (SetWindowPos(hwnd, HWND_TOP, work.left + (work.right - work.left - width) / 2,
                     work.top + (work.bottom - work.top - height) / 2,
                     width, height, SWP_NOACTIVATE | SWP_SHOWWINDOW)) {
      MSG message{};
      while (GetMessageW(&message, nullptr, 0, 0) > 0) {
        TranslateMessage(&message);
        DispatchMessageW(&message);
      }
    }
  }
  if (IsWindow(hwnd)) {
    DestroyWindow(hwnd);
  }
  UnregisterClassW(kWindowClass, instance);
}

}  // namespace

extern "C" void __cdecl Start(HWND, int, wchar_t*, NsisStackItem** stack,
                               NsisExtraParameters* nsis) {
  // The script removes its argument even if the plug-in cannot load.
  if (stack && *stack && nsis) {
    StartStatus(SelectLocale((*stack)->text), *nsis);
  }
}

extern "C" void CALLBACK ShowOneKeyUpdateStatusW(HWND, HINSTANCE,
                                                 wchar_t* argument, int) {
  SetErrorMode(SEM_FAILCRITICALERRORS | SEM_NOGPFAULTERRORBOX | SEM_NOOPENFILEERRORBOX);
  if (!argument || *argument < L'0' || *argument > L'9') {
    return;
  }
  wchar_t* end = nullptr;
  const unsigned long locale = wcstoul(argument, &end, 10);
  HMODULE module = nullptr;
  if (*end == L'\0' && locale < std::size(kLocales) &&
      GetModuleHandleExW(GET_MODULE_HANDLE_EX_FLAG_FROM_ADDRESS |
                             GET_MODULE_HANDLE_EX_FLAG_UNCHANGED_REFCOUNT,
                         reinterpret_cast<LPCWSTR>(&ShowOneKeyUpdateStatusW), &module)) {
    RunWindow(module, kLocales[locale]);
  }
}
