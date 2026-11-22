#include "window.h"

#include <oleacc.h>

#include <cmath>
#include <new>

namespace installer {
namespace {

HRESULT CopyString(std::wstring_view value, BSTR* result) {
  *result = nullptr;
  if (value.empty()) {
    return S_FALSE;
  }
  *result = SysAllocStringLen(value.data(), static_cast<UINT>(value.size()));
  return *result == nullptr ? E_OUTOFMEMORY : S_OK;
}

void SetChild(VARIANT* result, LONG id) {
  result->vt = VT_I4;
  result->lVal = id;
}

std::wstring CaptionName(HWND hwnd, UINT command, const wchar_t* fallback) {
  wchar_t text[128]{};
  const auto menu = GetSystemMenu(hwnd, FALSE);
  if (menu == nullptr || !GetMenuStringW(menu, command, text, 128, MF_BYCOMMAND)) {
    return fallback;
  }
  std::wstring name;
  for (const wchar_t* current = text; *current && *current != L'\t'; ++current) {
    if (*current == L'&' && *++current != L'&') {
      --current;
      continue;
    }
    name += *current;
  }
  return name;
}

}  // namespace

class Window::Accessible final : public IAccessible {
 public:
  explicit Accessible(Window& window) : window_(&window) {
    for (const auto& element : window.elements_) {
      const auto& node = *element.node;
      const auto name = node.Attribute(L"name");
      if (element.bounds.IsEmptyArea() || name == L"progress-value" ||
          node.Attribute(L"text") == L"!") {
        continue;
      }
      switch (node.kind) {
        case Kind::label:
          children_.push_back({&element, {}, ROLE_SYSTEM_STATICTEXT});
          if (node.Attribute(L"font") == L"1" && title_ == nullptr) {
            title_ = &node;
          }
          if (name == L"status") {
            status_ = &node;
          }
          break;
        case Kind::caption:
        case Kind::button:
          children_.push_back({&element, name,
              window.page_name_ == L"welcome" && (name == L"scope-current" || name == L"scope-all")
                  ? ROLE_SYSTEM_RADIOBUTTON : ROLE_SYSTEM_PUSHBUTTON});
          break;
        case Kind::progress:
          children_.push_back({&element, {}, ROLE_SYSTEM_PROGRESSBAR});
          break;
        case Kind::legal:
          for (const auto link : kLegalLinks) {
            children_.push_back({&element, link, ROLE_SYSTEM_LINK});
          }
          break;
        default:
          break;
      }
    }
    previous_ = &window.accessible_providers_;
    next_ = *previous_;
    if (next_) next_->previous_ = &next_;
    *previous_ = this;
  }

  ~Accessible() { Unlink(); }

  void Detach() { window_ = nullptr; }

  void Disconnect() {
    // COM can release its last reference while disconnecting this provider.
    AddRef();
    Detach();
    Unlink();
    CoDisconnectObject(this, 0);
    Release();
  }

  LONG ChildId(std::wstring_view target) const {
    for (std::size_t i = 0; i < children_.size(); ++i) {
      if (!target.empty() && children_[i].target == target) {
        return static_cast<LONG>(i + 1);
      }
    }
    return CHILDID_SELF;
  }

  LONG ChildIdForNode(std::wstring_view name) const {
    for (std::size_t i = 0; i < children_.size(); ++i) {
      if (children_[i].element->node->Attribute(L"name") == name) {
        return static_cast<LONG>(i + 1);
      }
    }
    return CHILDID_SELF;
  }

  HRESULT STDMETHODCALLTYPE QueryInterface(REFIID iid, void** result) override {
    if (!result) return E_POINTER;
    *result = nullptr;
    if (iid != IID_IUnknown && iid != IID_IDispatch && iid != IID_IAccessible) {
      return E_NOINTERFACE;
    }
    *result = static_cast<IAccessible*>(this);
    AddRef();
    return S_OK;
  }

  ULONG STDMETHODCALLTYPE AddRef() override { return ++references_; }
  ULONG STDMETHODCALLTYPE Release() override {
    const auto remaining = --references_;
    if (remaining == 0) delete this;
    return remaining;
  }

  HRESULT STDMETHODCALLTYPE GetTypeInfoCount(UINT* count) override {
    if (!count) return E_POINTER;
    *count = 0;
    return S_OK;
  }
  HRESULT STDMETHODCALLTYPE GetTypeInfo(UINT, LCID, ITypeInfo**) override { return E_NOTIMPL; }
  HRESULT STDMETHODCALLTYPE GetIDsOfNames(REFIID, LPOLESTR*, UINT, LCID, DISPID*) override {
    return E_NOTIMPL;
  }
  HRESULT STDMETHODCALLTYPE Invoke(DISPID, REFIID, LCID, WORD, DISPPARAMS*, VARIANT*,
                                   EXCEPINFO*, UINT*) override {
    return E_NOTIMPL;
  }

  HRESULT STDMETHODCALLTYPE get_accParent(IDispatch** result) override {
    if (!result) return E_POINTER;
    *result = nullptr;
    if (!window_) return CO_E_OBJNOTCONNECTED;
    return AccessibleObjectFromWindow(window_->hwnd_.load(), OBJID_WINDOW,
                                      IID_IDispatch, reinterpret_cast<void**>(result));
  }

  HRESULT STDMETHODCALLTYPE get_accChildCount(LONG* count) override {
    if (!count) return E_POINTER;
    *count = 0;
    if (!window_) return CO_E_OBJNOTCONNECTED;
    *count = static_cast<LONG>(children_.size());
    return S_OK;
  }

  HRESULT STDMETHODCALLTYPE get_accChild(VARIANT child, IDispatch** result) override {
    if (!result) return E_POINTER;
    *result = nullptr;
    const auto status = Validate(child);
    return FAILED(status) ? status : S_FALSE;
  }

  HRESULT STDMETHODCALLTYPE get_accName(VARIANT child, BSTR* result) override {
    if (!result) return E_POINTER;
    *result = nullptr;
    const auto status = Validate(child);
    if (FAILED(status)) return status;
    try {
      const auto* item = Child(child);
      if (!item) return CopyString(title_ ? Name(*title_) : L"OneKey Setup", result);
      if (item->target == L"minbtn" || item->target == L"closebtn") {
        const bool minimize = item->target == L"minbtn";
        return CopyString(CaptionName(window_->hwnd_.load(), minimize ? SC_MINIMIZE : SC_CLOSE,
                                      minimize ? L"Minimize" : L"Close"), result);
      }
      if (item->role == ROLE_SYSTEM_LINK) {
        const auto text = Name(*item->element->node);
        const auto marker = L"{a " + std::wstring(item->target) + L"}";
        const auto begin = text.find(marker);
        if (begin == std::wstring::npos) return S_FALSE;
        const auto first = begin + marker.size();
        const auto end = text.find(L"{/a}", first);
        if (end == std::wstring::npos) return S_FALSE;
        return CopyString(std::wstring_view(text).substr(first, end - first), result);
      }
      if (item->role == ROLE_SYSTEM_PROGRESSBAR) {
        return CopyString(title_ ? Name(*title_) : L"OneKey Setup", result);
      }
      return CopyString(Name(*item->element->node), result);
    } catch (const std::bad_alloc&) {
      return E_OUTOFMEMORY;
    }
  }

  HRESULT STDMETHODCALLTYPE get_accValue(VARIANT child, BSTR* result) override {
    if (!result) return E_POINTER;
    *result = nullptr;
    const auto status = Validate(child);
    if (FAILED(status)) return status;
    const auto* item = Child(child);
    if (!item || item->role != ROLE_SYSTEM_PROGRESSBAR) return S_FALSE;
    try {
      return CopyString(std::to_wstring(window_->state_.progress) + L"%", result);
    } catch (const std::bad_alloc&) {
      return E_OUTOFMEMORY;
    }
  }

  HRESULT STDMETHODCALLTYPE get_accDescription(VARIANT child, BSTR* result) override {
    if (!result) return E_POINTER;
    *result = nullptr;
    const auto status = Validate(child);
    if (FAILED(status)) return status;
    const auto* item = Child(child);
    if (item && item->role == ROLE_SYSTEM_PROGRESSBAR && status_) {
      try {
        return CopyString(Name(*status_), result);
      } catch (const std::bad_alloc&) {
        return E_OUTOFMEMORY;
      }
    }
    return S_FALSE;
  }

  HRESULT STDMETHODCALLTYPE get_accRole(VARIANT child, VARIANT* result) override {
    if (!result) return E_POINTER;
    VariantInit(result);
    const auto status = Validate(child);
    if (FAILED(status)) return status;
    const auto* item = Child(child);
    SetChild(result, item ? item->role : ROLE_SYSTEM_DIALOG);
    return S_OK;
  }

  HRESULT STDMETHODCALLTYPE get_accState(VARIANT child, VARIANT* result) override {
    if (!result) return E_POINTER;
    VariantInit(result);
    const auto status = Validate(child);
    if (FAILED(status)) return status;
    const auto hwnd = window_->hwnd_.load();
    const auto* item = Child(child);
    LONG flags = 0;
    if (!IsWindowVisible(hwnd)) flags |= STATE_SYSTEM_INVISIBLE;
    if (IsIconic(hwnd)) flags |= STATE_SYSTEM_OFFSCREEN;
    if (!item || !item->target.empty()) {
      if (item && !window_->Enabled(item->target)) {
        flags |= STATE_SYSTEM_UNAVAILABLE;
      } else {
        flags |= STATE_SYSTEM_FOCUSABLE;
        if (GetFocus() == hwnd && child.lVal == ChildId(window_->input_.focused)) {
          flags |= STATE_SYSTEM_FOCUSED;
        }
      }
    } else if (item->role == ROLE_SYSTEM_PROGRESSBAR) {
      flags |= STATE_SYSTEM_READONLY;
    }
    if (item && item->role == ROLE_SYSTEM_RADIOBUTTON &&
        (item->target == L"scope-all") == window_->state_.machine_scope) {
      flags |= STATE_SYSTEM_CHECKED;
    }
    if (item && item->target == L"more-options") {
      flags |= window_->state_.advanced_options ? STATE_SYSTEM_EXPANDED : STATE_SYSTEM_COLLAPSED;
    }
    if (item && item->role == ROLE_SYSTEM_LINK) flags |= STATE_SYSTEM_LINKED;
    SetChild(result, flags);
    return S_OK;
  }

  HRESULT STDMETHODCALLTYPE get_accHelp(VARIANT child, BSTR* result) override {
    if (!result) return E_POINTER;
    *result = nullptr;
    const auto status = Validate(child);
    return FAILED(status) ? status : S_FALSE;
  }
  HRESULT STDMETHODCALLTYPE get_accHelpTopic(BSTR* file, VARIANT child, LONG* topic) override {
    if (!file || !topic) return E_POINTER;
    *file = nullptr;
    *topic = -1;
    const auto status = Validate(child);
    return FAILED(status) ? status : S_FALSE;
  }
  HRESULT STDMETHODCALLTYPE get_accKeyboardShortcut(VARIANT child, BSTR* result) override {
    return get_accHelp(child, result);
  }

  HRESULT STDMETHODCALLTYPE get_accFocus(VARIANT* result) override {
    if (!result) return E_POINTER;
    VariantInit(result);
    if (!window_) return CO_E_OBJNOTCONNECTED;
    if (GetFocus() != window_->hwnd_.load()) return S_FALSE;
    SetChild(result, ChildId(window_->input_.focused));
    return S_OK;
  }

  HRESULT STDMETHODCALLTYPE get_accSelection(VARIANT* result) override {
    if (!result) return E_POINTER;
    VariantInit(result);
    return window_ ? S_FALSE : CO_E_OBJNOTCONNECTED;
  }

  HRESULT STDMETHODCALLTYPE get_accDefaultAction(VARIANT child, BSTR* result) override {
    if (!result) return E_POINTER;
    *result = nullptr;
    const auto status = Validate(child);
    if (FAILED(status)) return status;
    const auto* item = Child(child);
    return item && !item->target.empty() ? get_accName(child, result) : S_FALSE;
  }

  HRESULT STDMETHODCALLTYPE accSelect(LONG flags, VARIANT child) override {
    const auto status = Validate(child);
    if (FAILED(status)) return status;
    const auto* item = Child(child);
    if (flags != SELFLAG_TAKEFOCUS || (item && item->target.empty())) return E_INVALIDARG;
    if (item && !window_->Enabled(item->target)) return E_ACCESSDENIED;
    const auto hwnd = window_->hwnd_.load();
    if (!IsWindowVisible(hwnd) || IsIconic(hwnd)) return E_ACCESSDENIED;
    SetFocus(hwnd);
    if (GetFocus() != hwnd) return E_ACCESSDENIED;
    window_->input_.focused = item ? item->target : std::wstring_view{};
    window_->keyboard_focus_ = true;
    window_->Redraw();
    window_->NotifyAccessibleFocus();
    return S_OK;
  }

  HRESULT STDMETHODCALLTYPE accLocation(LONG* x, LONG* y, LONG* width, LONG* height,
                                        VARIANT child) override {
    if (!x || !y || !width || !height) return E_POINTER;
    *x = *y = *width = *height = 0;
    const auto status = Validate(child);
    if (FAILED(status)) return status;
    const auto hwnd = window_->hwnd_.load();
    const auto* item = Child(child);
    RECT bounds{};
    if (item) {
      const auto rect = Bounds(*item);
      if (rect.IsEmptyArea()) return S_FALSE;
      const auto scale = window_->scale_;
      bounds = {std::lround(rect.X * scale), std::lround(rect.Y * scale),
                std::lround(rect.GetRight() * scale), std::lround(rect.GetBottom() * scale)};
      MapWindowPoints(hwnd, nullptr, reinterpret_cast<POINT*>(&bounds), 2);
    } else if (!GetWindowRect(hwnd, &bounds)) {
      return E_FAIL;
    }
    *x = bounds.left;
    *y = bounds.top;
    *width = bounds.right - bounds.left;
    *height = bounds.bottom - bounds.top;
    return S_OK;
  }

  HRESULT STDMETHODCALLTYPE accNavigate(LONG direction, VARIANT child, VARIANT* result) override {
    if (!result) return E_POINTER;
    VariantInit(result);
    const auto status = Validate(child);
    if (FAILED(status)) return status;
    const auto count = static_cast<LONG>(children_.size());
    LONG id;
    switch (direction) {
      case NAVDIR_FIRSTCHILD: id = child.lVal == CHILDID_SELF ? 1 : 0; break;
      case NAVDIR_LASTCHILD: id = child.lVal == CHILDID_SELF ? count : 0; break;
      case NAVDIR_NEXT: id = child.lVal == CHILDID_SELF ? 0 : child.lVal + 1; break;
      case NAVDIR_PREVIOUS: id = child.lVal - 1; break;
      default: return E_NOTIMPL;
    }
    if (id < 1 || id > count) return S_FALSE;
    SetChild(result, id);
    return S_OK;
  }

  HRESULT STDMETHODCALLTYPE accHitTest(LONG x, LONG y, VARIANT* result) override {
    if (!result) return E_POINTER;
    VariantInit(result);
    if (!window_) return CO_E_OBJNOTCONNECTED;
    const auto hwnd = window_->hwnd_.load();
    POINT point{x, y};
    RECT client{};
    if (!IsWindowVisible(hwnd) || IsIconic(hwnd) || !ScreenToClient(hwnd, &point) ||
        !GetClientRect(hwnd, &client) || !PtInRect(&client, point)) {
      return S_FALSE;
    }
    const auto scale = window_->scale_;
    for (auto i = children_.size(); i > 0; --i) {
      if (Bounds(children_[i - 1]).Contains(point.x / scale, point.y / scale)) {
        SetChild(result, static_cast<LONG>(i));
        return S_OK;
      }
    }
    SetChild(result, CHILDID_SELF);
    return S_OK;
  }

  HRESULT STDMETHODCALLTYPE accDoDefaultAction(VARIANT child) override {
    const auto status = Validate(child);
    if (FAILED(status)) return status;
    const auto* item = Child(child);
    if (!item || item->target.empty()) return E_INVALIDARG;
    const auto hwnd = window_->hwnd_.load();
    if (!IsWindowVisible(hwnd) || IsIconic(hwnd) || !window_->Enabled(item->target)) {
      return E_ACCESSDENIED;
    }
    try {
      window_->Activate(item->target);
      return S_OK;
    } catch (const std::bad_alloc&) {
      return E_OUTOFMEMORY;
    }
  }

  HRESULT STDMETHODCALLTYPE put_accName(VARIANT, BSTR) override { return E_NOTIMPL; }
  HRESULT STDMETHODCALLTYPE put_accValue(VARIANT, BSTR) override { return E_NOTIMPL; }

 private:
  struct Item {
    const Element* element;
    std::wstring_view target;
    LONG role;
  };

  HRESULT Validate(VARIANT child) const {
    if (!window_) return CO_E_OBJNOTCONNECTED;
    return child.vt == VT_I4 && child.lVal >= CHILDID_SELF &&
           child.lVal <= static_cast<LONG>(children_.size()) ? S_OK : E_INVALIDARG;
  }

  const Item* Child(VARIANT child) const {
    return child.lVal == CHILDID_SELF ? nullptr : &children_[child.lVal - 1];
  }

  std::wstring Name(const Node& node) const {
    return ElementText(node, window_->state_, window_->page_name_ == L"welcome");
  }

  Gdiplus::RectF Bounds(const Item& item) const {
    if (item.role == ROLE_SYSTEM_LINK) {
      return window_->legal_bounds_[item.target == kLegalLinks[0] ? 0 : 1];
    }
    return item.element->bounds;
  }

  void Unlink() {
    if (!previous_) return;
    *previous_ = next_;
    if (next_) next_->previous_ = previous_;
    previous_ = nullptr;
    next_ = nullptr;
  }

  Accessible** previous_ = nullptr;
  Accessible* next_ = nullptr;
  std::atomic<ULONG> references_{1};
  Window* window_;
  std::vector<Item> children_;
  const Node* title_ = nullptr;
  const Node* status_ = nullptr;
};

void Window::ResetAccessibility() {
  if (accessible_) {
    accessible_->Detach();
    accessible_->Release();
    accessible_ = nullptr;
  }
}

void Window::CloseAccessibility() {
  ResetAccessibility();
  while (accessible_providers_) {
    accessible_providers_->Disconnect();
  }
  if (accessibility_com_initialized_) {
    CoUninitialize();
    accessibility_com_initialized_ = false;
  }
}

LRESULT Window::GetAccessibility(WPARAM wparam) {
  if (!accessibility_com_initialized_) {
    if (FAILED(CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED))) return 0;
    accessibility_com_initialized_ = true;
  }
  if (!accessible_) {

    try {
      accessible_ = new Accessible(*this);
    } catch (const std::bad_alloc&) {
      return 0;
    }
  }
  return LresultFromObject(IID_IAccessible, wparam, accessible_);
}

void Window::NotifyAccessibleFocus() {
  const auto hwnd = hwnd_.load();
  if (hwnd && GetFocus() == hwnd) {
    NotifyWinEvent(EVENT_OBJECT_FOCUS, hwnd, OBJID_CLIENT,
                   accessible_ ? accessible_->ChildId(input_.focused) : CHILDID_SELF);
  }
}

void Window::NotifyAccessibleChange(DWORD event, std::wstring_view node) {
  if (const auto hwnd = hwnd_.load(); hwnd && accessible_) {
    const auto child = accessible_->ChildIdForNode(node);
    if (child != CHILDID_SELF) {
      NotifyWinEvent(event, hwnd, OBJID_CLIENT, child);
    }
  }
}

}  // namespace installer
