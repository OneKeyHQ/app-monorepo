#include "window.h"
#include "legal-links.h"
#include "uninstall-retry.h"

#include <commctrl.h>

#include <algorithm>
#include <atomic>
#include <cwchar>
#include <memory>
#include <string_view>
#include <utility>

namespace {

// NSIS 3 Unicode plugin ABI. All exports use the C calling convention
// and return exactly one string on the NSIS stack.
struct StackItem {
  StackItem* next;
  wchar_t text[1];
};

enum PluginMessage { unload, gui_unload };
using Callback = UINT_PTR(__cdecl*)(PluginMessage);
struct ExtraParameters {
  void* execution_flags;
  int(WINAPI* execute_code_segment)(int, HWND);
  void(WINAPI* validate_filename)(wchar_t*);
  int(WINAPI* register_callback)(HMODULE, Callback);
};

class Stack {
 public:
  Stack(int capacity, StackItem** items) : capacity_(capacity), items_(items) {}

  bool Pop(std::wstring& value) {
    if (items_ == nullptr || *items_ == nullptr || capacity_ <= 0) {
      return false;
    }
    const auto item = *items_;
    value.assign(item->text, wcsnlen_s(item->text, static_cast<std::size_t>(capacity_)));
    *items_ = item->next;
    GlobalFree(item);
    return true;
  }

  void Push(std::wstring_view value) {
    if (items_ == nullptr || capacity_ <= 0) {
      return;
    }
    const auto capacity = static_cast<std::size_t>(capacity_);
    const auto bytes = offsetof(StackItem, text) + capacity * sizeof(wchar_t);
    const auto item = static_cast<StackItem*>(GlobalAlloc(GPTR, bytes));
    if (item != nullptr) {
      const auto length = std::min(value.size(), capacity - 1);
      if (length != 0) {
        std::copy_n(value.data(), length, item->text);
      }
      item->next = *items_;
      *items_ = item;
    }
  }

 private:
  int capacity_;
  StackItem** items_;
};

std::shared_ptr<installer::Window> g_window;
HMODULE g_module = nullptr;
std::atomic<HWND> g_concealed_host{nullptr};
constexpr UINT_PTR kConcealSubclass = 0x4F4B;
constexpr UINT kRestoreHost = WM_APP + 0x4B;

LRESULT CALLBACK ConcealHostProc(HWND hwnd, UINT message, WPARAM wparam,
                                 LPARAM lparam, UINT_PTR id, DWORD_PTR) {
  if (message == kRestoreHost && wparam == kConcealSubclass) {
    RemoveWindowSubclass(hwnd, ConcealHostProc, id);
    g_concealed_host.compare_exchange_strong(hwnd, nullptr);
    return 0;
  }
  if (message == WM_WINDOWPOSCHANGING) {
    auto* position = reinterpret_cast<WINDOWPOS*>(lparam);
    if ((position->flags & SWP_SHOWWINDOW) != 0) {
      position->flags &= ~SWP_SHOWWINDOW;
      position->flags |= SWP_HIDEWINDOW;
    }
  } else if (message == WM_SHOWWINDOW && wparam != FALSE) {
    ShowWindow(hwnd, SW_HIDE);
    return 0;
  } else if (message == WM_NCDESTROY) {
    RemoveWindowSubclass(hwnd, ConcealHostProc, id);
    auto concealed = hwnd;
    g_concealed_host.compare_exchange_strong(concealed, nullptr);
  }
  return DefSubclassProc(hwnd, message, wparam, lparam);
}

void RestoreHost() {
  const auto host = g_concealed_host.load();
  DWORD process = 0;
  if (GetWindowThreadProcessId(host, &process) != 0 &&
      process == GetCurrentProcessId()) {
    // The host can outlive the renderer. Its own GUI thread removes the subclass.
    SendMessageW(host, kRestoreHost, kConcealSubclass, 0);
  }
}

bool HideHost(HWND host) {
  const auto owner_thread = GetWindowThreadProcessId(host, nullptr);
  if (owner_thread == 0) {
    return true;
  }
  if (owner_thread != GetCurrentThreadId()) {
    return false;
  }
  if (host == g_concealed_host.load()) {
    return true;
  }
  RestoreHost();
  if (!SetWindowSubclass(host, ConcealHostProc, kConcealSubclass, 0)) {
    return false;
  }
  g_concealed_host.store(host);
  ShowWindow(host, SW_HIDE);
  return true;
}

void ShutdownWindow(bool restore_host) {
  const auto window = std::atomic_exchange(&g_window, std::shared_ptr<installer::Window>{});
  if (window && window->Invoke([&] {
        if (restore_host) {
          RestoreHost();
        }
        window->Destroy();
      })) {
    return;
  }
  if (restore_host) {
    RestoreHost();
  }
}

UINT_PTR __cdecl OnPluginMessage(PluginMessage message) {
  if (message == gui_unload || message == unload) {
    ShutdownWindow(true);
  }
  return 0;
}

template<typename Function>
void WithWindow(Stack& stack, Function operation, std::wstring_view unavailable = L"error:window unavailable") {
  try {
    const auto window = std::atomic_load(&g_window);
    auto result = unavailable;
    if (window) {
      window->Invoke([&] { result = operation(*window); });
    }
    stack.Push(result);
  } catch (...) {
    stack.Push(L"error:native window operation failed");
  }
}

template<typename Function>
void WithText(Stack& stack, Function operation) {
  std::wstring value;
  if (!stack.Pop(value)) {
    stack.Push(L"error:missing argument");
    return;
  }
  WithWindow(stack, [&](installer::Window& window) { return operation(window, value); });
}

void Progress(Stack& stack, bool reset) {
  WithText(stack, [reset](installer::Window& window, const std::wstring& text) {
    wchar_t* end = nullptr;
    const long value = wcstol(text.c_str(), &end, 10);
    if (end == text.c_str() || *end != L'\0') {
      return L"error:progress must be an integer";
    }
    window.SetProgress(static_cast<int>(std::clamp(value, 0L, 100L)), reset);
    return L"ok";
  });
}

void Directory(Stack& stack, std::wstring_view scope) {
  WithText(stack, [scope](installer::Window& window, std::wstring& value) {
    window.SetDirectory(std::move(value), scope);
    return L"ok";
  });
}

void UninstallRetry(Stack& stack, bool launch) {
  std::wstring path;
  std::wstring scope;
  try {
    if (stack.Pop(path) && stack.Pop(scope) && installer::UninstallRetry(path, scope, launch)) {
      stack.Push(L"ok");
      return;
    }
  } catch (...) {
  }
  stack.Push(L"error:uninstaller retry unavailable");
}

#define NSIS_ENTRY(name) \
  extern "C" void __cdecl name([[maybe_unused]] HWND parent, int capacity, wchar_t*, \
                                StackItem** items, [[maybe_unused]] ExtraParameters* extra)

}  // namespace

NSIS_ENTRY(Init) {
  Stack stack(capacity, items);
  try {
    std::wstring locale;
    std::wstring version;
    if (!stack.Pop(locale) || !stack.Pop(version)) {
      stack.Push(L"error:Init expects locale and version");
      return;
    }
    ShutdownWindow(true);
    if (extra == nullptr || extra->register_callback == nullptr ||
        extra->register_callback(g_module, OnPluginMessage) < 0) {
      stack.Push(L"error:NSIS plugin callback unavailable");
      return;
    }
    auto window = std::make_shared<installer::Window>(g_module, std::move(locale), std::move(version));
    if (!window->Create(parent)) {
      stack.Push(L"error:could not create installer window");
      return;
    }
    if (!HideHost(parent)) {
      window->Destroy();
      stack.Push(L"error:could not hide NSIS host");
      return;
    }
    std::atomic_store(&g_window, std::move(window));
    stack.Push(L"ok");
  } catch (...) {
    ShutdownWindow(true);
    stack.Push(L"error:could not initialize native installer UI");
  }
}

NSIS_ENTRY(ConcealHost) {
  Stack stack(capacity, items);
  const auto window = std::atomic_load(&g_window);
  if (!window) {
    if (extra == nullptr || extra->register_callback == nullptr ||
        extra->register_callback(g_module, OnPluginMessage) < 0) {
      stack.Push(L"error:NSIS plugin callback unavailable");
      return;
    }
    stack.Push(HideHost(parent) ? L"ok" : L"error:could not hide NSIS host");
    return;
  }
  WithWindow(stack, [&](installer::Window& active) {
    active.BindHost(parent);
    return HideHost(parent) ? L"ok" : L"error:could not hide NSIS host";
  });
}

NSIS_ENTRY(Show) {
  Stack stack(capacity, items);
  WithWindow(stack, [](installer::Window& window) {
    window.Show();
    return L"ok";
  });
}

NSIS_ENTRY(Hide) {
  Stack stack(capacity, items);
  WithWindow(stack, [](installer::Window& window) {
    window.Hide();
    return L"ok";
  });
}

NSIS_ENTRY(SetPage) {
  Stack stack(capacity, items);
  WithText(stack, [](installer::Window& window, std::wstring& page) {
    return window.SetPage(page) ? L"ok" : L"error:unknown installer page";
  });
}

NSIS_ENTRY(SetProgress) {
  Stack stack(capacity, items);
  Progress(stack, false);
}

NSIS_ENTRY(ResetProgress) {
  Stack stack(capacity, items);
  Progress(stack, true);
}

NSIS_ENTRY(SetInstallDirectory) {
  Stack stack(capacity, items);
  Directory(stack, L"");
}

NSIS_ENTRY(SetPerUserInstallDirectory) {
  Stack stack(capacity, items);
  Directory(stack, L"current");
}

NSIS_ENTRY(SetPerMachineInstallDirectory) {
  Stack stack(capacity, items);
  Directory(stack, L"all");
}

NSIS_ENTRY(SetStatus) {
  Stack stack(capacity, items);
  WithText(stack, [](installer::Window& window, std::wstring& value) {
    window.SetStatus(std::move(value));
    return L"ok";
  });
}

NSIS_ENTRY(SetVersion) {
  Stack stack(capacity, items);
  WithText(stack, [](installer::Window& window, std::wstring& value) {
    window.SetVersion(std::move(value));
    return L"ok";
  });
}

NSIS_ENTRY(PollEvent) {
  Stack stack(capacity, items);
  WithWindow(stack, [](installer::Window& window) { return window.Event(false); }, L"closed");
}

NSIS_ENTRY(WaitForEvent) {
  Stack stack(capacity, items);
  WithWindow(stack, [](installer::Window& window) { return window.Event(true); }, L"closed");
}

NSIS_ENTRY(PrepareCommit) {
  Stack stack(capacity, items);
  WithWindow(stack, [](installer::Window& window) { return window.PrepareCommit(); }, L"error:window unavailable");
}

NSIS_ENTRY(OpenLegalLink) {
  Stack stack(capacity, items);
  try {
    std::wstring link;
    stack.Push(stack.Pop(link) ? installer::OpenLegalLink(link) : L"");
  } catch (...) {
    stack.Push(L"");
  }
}

NSIS_ENTRY(CheckUninstallRetry) {
  Stack stack(capacity, items);
  UninstallRetry(stack, false);
}

NSIS_ENTRY(RetryUninstall) {
  Stack stack(capacity, items);
  UninstallRetry(stack, true);
}

NSIS_ENTRY(Shutdown) {
  Stack stack(capacity, items);
  ShutdownWindow(true);
  stack.Push(L"ok");
}

NSIS_ENTRY(ShutdownHidden) {
  Stack stack(capacity, items);
  ShutdownWindow(false);
  stack.Push(L"ok");
}

BOOL WINAPI DllMain(HINSTANCE module, DWORD reason, LPVOID) {
  if (reason == DLL_PROCESS_ATTACH) {
    g_module = module;
  }
  return TRUE;
}
