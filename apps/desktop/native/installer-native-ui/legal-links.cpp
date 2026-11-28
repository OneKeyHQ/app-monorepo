#include "legal-links.h"

#include <windows.h>

#include <ole2.h>
#include <exdisp.h>
#include <shellapi.h>
#include <shlguid.h>
#include <shlobj.h>
#include <wrl/client.h>

namespace installer {
namespace {

using Microsoft::WRL::ComPtr;

bool HasUnelevatedToken(HANDLE process) {
  HANDLE token = nullptr;
  if (!OpenProcessToken(process, TOKEN_QUERY, &token)) return false;
  TOKEN_ELEVATION elevation{};
  DWORD size = 0;
  const bool unelevated = GetTokenInformation(token, TokenElevation, &elevation,
                                             sizeof(elevation), &size) &&
                          elevation.TokenIsElevated == 0;
  CloseHandle(token);
  return unelevated;
}

bool IsUnelevatedDesktop(HWND desktop) {
  DWORD desktop_pid = 0;
  DWORD shell_pid = 0;
  GetWindowThreadProcessId(desktop, &desktop_pid);
  GetWindowThreadProcessId(GetShellWindow(), &shell_pid);
  if (desktop_pid == 0 || desktop_pid != shell_pid) return false;
  const HANDLE process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, FALSE, shell_pid);
  if (!process) return false;
  const bool unelevated = HasUnelevatedToken(process);
  CloseHandle(process);
  return unelevated;
}

bool OpenFromDesktop(const wchar_t* url) {
  ComPtr<IShellWindows> windows;
  ComPtr<IDispatch> desktop;
  VARIANT location{}, unused{};
  location.vt = VT_I4;
  location.lVal = CSIDL_DESKTOP;
  long hwnd = 0;
  if (FAILED(CoCreateInstance(CLSID_ShellWindows, nullptr, CLSCTX_LOCAL_SERVER,
                              IID_PPV_ARGS(windows.GetAddressOf()))) ||
      windows->FindWindowSW(&location, &unused, SWC_DESKTOP, &hwnd, SWFO_NEEDDISPATCH,
                            desktop.GetAddressOf()) != S_OK ||
      !desktop || !IsUnelevatedDesktop(reinterpret_cast<HWND>(hwnd))) {
    return false;
  }
  ComPtr<IServiceProvider> services;
  ComPtr<IShellBrowser> browser;
  ComPtr<IShellView> view;
  ComPtr<IShellFolderViewDual> folder;
  ComPtr<IDispatch> application;
  ComPtr<IShellDispatch2> shell;
  if (FAILED(desktop.As(&services)) ||
      FAILED(services->QueryService(SID_STopLevelBrowser, IID_PPV_ARGS(browser.GetAddressOf()))) ||
      FAILED(browser->QueryActiveShellView(view.GetAddressOf())) ||
      FAILED(view->GetItemObject(SVGIO_BACKGROUND, IID_PPV_ARGS(folder.GetAddressOf()))) ||
      FAILED(folder->get_Application(application.GetAddressOf())) || FAILED(application.As(&shell))) {
    return false;
  }
  const auto target = SysAllocString(url);
  if (!target) return false;
  const auto result = shell->ShellExecute(target, unused, unused, unused, unused);
  SysFreeString(target);
  return SUCCEEDED(result);
}

}  // namespace

std::wstring_view OpenLegalLink(std::wstring_view link) {
  const wchar_t* url = nullptr;
  if (link == L"terms") url = L"https://help.onekey.so/articles/11461297";
  if (link == L"privacy") url = L"https://help.onekey.so/articles/11461298";
  if (!url) return {};
  const auto initialized = CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED | COINIT_DISABLE_OLE1DDE);
  if (FAILED(initialized) && initialized != RPC_E_CHANGED_MODE) return url;
  const bool opened = HasUnelevatedToken(GetCurrentProcess())
      ? reinterpret_cast<INT_PTR>(ShellExecuteW(nullptr, L"open", url, nullptr, nullptr,
                                                 SW_SHOWNORMAL)) > 32
      : OpenFromDesktop(url);
  if (SUCCEEDED(initialized)) CoUninitialize();
  return opened ? L"ok" : url;
}

}  // namespace installer
