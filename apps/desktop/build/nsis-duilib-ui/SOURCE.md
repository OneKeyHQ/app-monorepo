# nsis-duilib-ui provenance

- Source: https://github.com/huhuanming/nsis-duilib-ui
- Base commit: `a35a32a6c4ec1737296b9e52eca77064492ffd00`
- Local patches: OK-64279, OK-64284, OK-64289, OK-64291, OK-64292, and OK-64308, embedded below;
  use the system
  frame when DWM accepts rounded corners, otherwise retain DuiLib region
  clipping. Load window icons from the host EXE, including during un.onInit.
  Center the minimize glyph horizontally and vertically in its button.
  Resolve installed UI fonts by locale, preserve custom theme font choices,
  and keep regular/bold weights consistent when fonts are rebuilt for DPI.
  Open the current official help-center Terms and Privacy Policy articles.
  Preserve confirmed cancellation across progress updates, synchronize UI-thread
  transitions and shutdown, and lock cancellation before committing staged files.
- Modified source files (relative to the base commit):
  - `include/nsis_dui/window.hpp`
  - `plugin/nsis_plugin.cpp`
  - `plugin/nsis-duilib-ui.def`
  - `src/renderer.cpp`
  - `src/window.cpp`
  - `tests/renderer_test.cpp`
  - `third_party/duilib/Core/UIManager.cpp`
- Target: Win32/x86 Unicode NSIS plug-in
- Configuration: Release, static MSVC runtime (`/MT`)
- Output: `out/build/windows-x86-ninja/Release/nsis-duilib-ui.dll`
- SHA256: `e947164986a86c14398ad73851d6afb0927de065841d93b1bf3ea71fe9627212`

Build and test from a clean checkout on Windows with Visual Studio 2022,
CMake 3.24 or later, and Ninja:

```powershell
git checkout a35a32a6c4ec1737296b9e52eca77064492ffd00
$sourcePatch = @'
diff --git a/include/nsis_dui/window.hpp b/include/nsis_dui/window.hpp
index 580847629a..60b77afd46 100644
--- a/include/nsis_dui/window.hpp
+++ b/include/nsis_dui/window.hpp
@@ -24,6 +24,8 @@ enum class WindowEvent {
   closed,
 };

+enum class CommitPreparation { ready, pending, cancelled };
+
 class InstallerWindow final {
  public:
   InstallerWindow();
@@ -43,6 +45,7 @@ class InstallerWindow final {
   [[nodiscard]] int RunMessageLoop() noexcept;
   [[nodiscard]] WindowEvent WaitForEvent() noexcept;
   void PumpMessages() noexcept;
+  [[nodiscard]] CommitPreparation PrepareCommit() noexcept;

   [[nodiscard]] bool SetPage(const std::string& page_name) noexcept;
   void SetProgress(int progress) noexcept;
diff --git a/plugin/nsis_plugin.cpp b/plugin/nsis_plugin.cpp
index bfb4f91d0a..a49691f22d 100644
--- a/plugin/nsis_plugin.cpp
+++ b/plugin/nsis_plugin.cpp
@@ -538,6 +538,27 @@ NSIS_ENTRY(PollEvent) {
   }
 }

+NSIS_ENTRY(PrepareCommit) {
+  Stack stack(string_size, stack_top);
+  if (!g_window) {
+    stack.Error("plugin is not initialized");
+    return;
+  }
+  g_last_poll_at = GetTickCount64();
+  g_window->PumpMessages();
+  switch (g_window->PrepareCommit()) {
+    case nsis_dui::CommitPreparation::ready:
+      stack.Ok();
+      break;
+    case nsis_dui::CommitPreparation::pending:
+      stack.Push(L"pending");
+      break;
+    case nsis_dui::CommitPreparation::cancelled:
+      stack.Push(L"cancel");
+      break;
+  }
+}
+
 NSIS_ENTRY(WaitForEvent) {
   Stack stack(string_size, stack_top);
   if (!g_window) {
diff --git a/plugin/nsis-duilib-ui.def b/plugin/nsis-duilib-ui.def
index bae81c902b..c55657da17 100644
--- a/plugin/nsis-duilib-ui.def
+++ b/plugin/nsis-duilib-ui.def
@@ -5,6 +5,7 @@ EXPORTS
   Hide
   Init
   PollEvent
+  PrepareCommit
   ResetProgress
   SetPage
   SetProgress
diff --git a/src/renderer.cpp b/src/renderer.cpp
index 48d051f..2f940b8 100644
--- a/src/renderer.cpp
+++ b/src/renderer.cpp
@@ -80,6 +80,93 @@ namespace {
   return result.substr(first, last - first + 1);
 }

+struct InstalledFont {
+  std::wstring family;
+  bool present = false;
+  bool bold = false;
+};
+
+int CALLBACK InspectFont(const LOGFONTW* font,
+                         const TEXTMETRICW*,
+                         DWORD,
+                         LPARAM parameter) {
+  auto& installed = *reinterpret_cast<InstalledFont*>(parameter);
+  installed.present = true;
+  installed.bold = installed.bold ||
+                   (font->lfWeight == FW_BOLD && font->lfItalic == FALSE);
+  return 1;
+}
+
+[[nodiscard]] InstalledFont FindInstalledFont(const std::string& family) {
+  InstalledFont installed{Utf8ToWide(family)};
+  if (installed.family.size() >= LF_FACESIZE) {
+    return installed;
+  }
+  LOGFONTW font{};
+  font.lfCharSet = DEFAULT_CHARSET;
+  wcscpy_s(font.lfFaceName, installed.family.c_str());
+  const HDC dc = GetDC(nullptr);
+  if (dc != nullptr) {
+    EnumFontFamiliesExW(dc, &font, InspectFont,
+                       reinterpret_cast<LPARAM>(&installed), 0);
+    ReleaseDC(nullptr, dc);
+  }
+  return installed;
+}
+
+[[nodiscard]] std::string LocaleFontFamily(const std::string& locale) {
+  const auto separator = locale.find('-');
+  const std::string language = locale.substr(0, separator);
+  if (language == "zh") {
+    return locale == "zh-HK" || locale == "zh-TW"
+               ? "Microsoft JhengHei UI"
+               : "Microsoft YaHei UI";
+  }
+  if (language == "ja") return "Yu Gothic UI";
+  if (language == "ko") return "Malgun Gothic";
+  if (language == "th") return "Leelawadee UI";
+  if (language == "hi" || language == "bn") return "Nirmala UI";
+  return "Segoe UI";
+}
+
+struct SelectedFont {
+  std::string family;
+  bool bold = false;
+};
+
+[[nodiscard]] SelectedFont SelectFont(const ThemePackage& package) {
+  const std::string& families = package.typography.font_family;
+  const std::string preferred_family = FirstFontFamily(families);
+  InstalledFont installed;
+  if (_stricmp(preferred_family.c_str(), "Segoe UI") == 0) {
+    const std::string locale_family = LocaleFontFamily(package.locale);
+    installed = FindInstalledFont(locale_family);
+    if (installed.present) {
+      return {locale_family, installed.bold};
+    }
+  }
+  std::size_t offset = 0;
+  while (offset < families.size()) {
+    const std::size_t end = families.find(',', offset);
+    const std::string candidate = families.substr(offset, end - offset);
+    if (candidate.find_first_not_of(" \t") != std::string::npos) {
+      const std::string family = FirstFontFamily(candidate);
+      installed = FindInstalledFont(family);
+      if (installed.present) {
+        return {family, installed.bold};
+      }
+    }
+    if (end == std::string::npos) break;
+    offset = end + 1;
+  }
+  installed = FindInstalledFont("Segoe UI");
+  if (installed.present) {
+    return {"Segoe UI", installed.bold};
+  }
+  // Keep Windows' normal font mapping when no configured family is installed.
+  return {preferred_family, false};
+}
+
 void ReplaceAll(std::string& value,
                 const std::string& needle,
                 const std::string& replacement) {
@@ -103,7 +190,9 @@ void ReplaceAll(std::string& value,
     values.emplace("string." + name, std::move(resolved));
   }

-  values.emplace("font.family", FirstFontFamily(package.typography.font_family));
+  const SelectedFont font = SelectFont(package);
+  values.emplace("font.family", font.family);
+  values.emplace("font.emphasisBold", font.bold ? "true" : "false");
   values.emplace("font.titleSize", std::to_string(package.typography.title_size));
   values.emplace("font.bodySize", std::to_string(package.typography.body_size));
   values.emplace("window.width", std::to_string(package.window.width));
diff --git a/src/window.cpp b/src/window.cpp
index e14e79c896..622cac3c0d 100644
--- a/src/window.cpp
+++ b/src/window.cpp
@@ -68,20 +68,23 @@ class ThreadDpiScope final {
   DPI_AWARENESS_CONTEXT previous_ = nullptr;
 };

-void ApplyModernCorners(HWND window) noexcept {
+[[nodiscard]] bool ApplyModernCorners(HWND window) noexcept {
   const HMODULE dwmapi = LoadLibraryW(L"dwmapi.dll");
   if (dwmapi == nullptr) {
-    return;
+    return false;
   }
   using SetWindowAttribute = HRESULT(WINAPI*)(HWND, DWORD, LPCVOID, DWORD);
   const auto set_attribute = reinterpret_cast<SetWindowAttribute>(
       GetProcAddress(dwmapi, "DwmSetWindowAttribute"));
+  bool applied = false;
   if (set_attribute != nullptr) {
     constexpr DWORD kWindowCornerPreference = 33;
     constexpr DWORD kRound = 2;
-    set_attribute(window, kWindowCornerPreference, &kRound, sizeof(kRound));
+    applied = SUCCEEDED(set_attribute(window, kWindowCornerPreference,
+                                      &kRound, sizeof(kRound)));
   }
   FreeLibrary(dwmapi);
+  return applied;
 }

 [[nodiscard]] UINT EffectiveDpiForMonitor(HMONITOR monitor,
@@ -235,8 +238,8 @@ class CaptionButtonControl final : public DuiLib::CButtonUI {
                         center_x - radius, center_y + radius);
     } else {
       const Gdiplus::REAL half_width = width * 0.19F;
-      graphics.DrawLine(&pen, center_x - half_width, center_y + 3.0F,
-                        center_x + half_width, center_y + 3.0F);
+      graphics.DrawLine(&pen, center_x - half_width, center_y,
+                        center_x + half_width, center_y);
     }
     return true;
   }
@@ -796,6 +799,12 @@ class InstallerWindow::Impl final : public DuiLib::WindowImplBase {
     if (IsWindow(m_hWnd)) {
       DestroyWindow(m_hWnd);
     }
+    if (large_icon_ != nullptr) {
+      DestroyIcon(large_icon_);
+    }
+    if (small_icon_ != nullptr) {
+      DestroyIcon(small_icon_);
+    }
   }

   [[nodiscard]] bool OpenHost(HWND owner) noexcept {
@@ -814,7 +823,14 @@ class InstallerWindow::Impl final : public DuiLib::WindowImplBase {
         return false;
       }
       CenterWindow();
-      ApplyModernCorners(created);
+      // The NSIS host window does not exist yet during un.onInit.
+      EnumResourceNamesW(GetModuleHandleW(nullptr), RT_GROUP_ICON,
+                         LoadHostIcons, reinterpret_cast<LONG_PTR>(this));
+      if (system_frame_) {
+        SetWindowPos(created, nullptr, 0, 0, 0, 0,
+                     SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER |
+                         SWP_NOACTIVATE | SWP_FRAMECHANGED);
+      }
       return true;
     } catch (const std::exception& error) {
       error_ = error.what();
@@ -846,17 +862,30 @@ class InstallerWindow::Impl final : public DuiLib::WindowImplBase {

   void CloseInstaller() noexcept {
     if (IsWindow(m_hWnd)) {
-      Close(IDCANCEL);
+      // Explicit plug-in shutdown must bypass the user's exit confirmation,
+      // including when requested by the NSIS installation worker.
+      ::SendMessageW(m_hWnd, kShutdownWindow, 0, 0);
     }
   }

   [[nodiscard]] bool SetPageName(const std::string& page_name) noexcept {
     page_name_ = page_name;
+    operation_cancel_locked_ = false;
     suspended_page_name_.clear();
     event_ = WindowEvent::none;
     return AttachPage();
   }

+  [[nodiscard]] CommitPreparation PrepareCommit() noexcept {
+    if (!IsWindow(m_hWnd)) {
+      return CommitPreparation::cancelled;
+    }
+    // The installation section runs on the NSIS worker thread. Serialize the
+    // cancellation decision and control updates on the window's UI thread.
+    return static_cast<CommitPreparation>(
+        ::SendMessageW(m_hWnd, kPrepareCommit, 0, 0));
+  }
+
   void SetProgressValue(int progress) noexcept {
     state_.progress = (std::max)(state_.progress, std::clamp(progress, 0, 100));
     if (DuiLib::CControlUI* control = m_pm.FindControl(L"progress");
@@ -969,9 +998,9 @@ class InstallerWindow::Impl final : public DuiLib::WindowImplBase {
   void OpenLegalLink(const DuiLib::CDuiString& target) noexcept {
     const wchar_t* url = nullptr;
     if (_wcsicmp(target.GetData(), L"terms") == 0) {
-      url = L"https://onekey.so/terms";
+      url = L"https://help.onekey.so/zh-CN/articles/11461297-%E6%9C%8D%E5%8A%A1%E5%8D%8F%E8%AE%AE";
     } else if (_wcsicmp(target.GetData(), L"privacy") == 0) {
-      url = L"https://onekey.so/privacy";
+      url = L"https://help.onekey.so/zh-CN/articles/11461298-privacy-policy";
     }
     if (url != nullptr) {
       ShellExecuteW(m_hWnd, L"open", url, nullptr, nullptr, SW_SHOWNORMAL);
@@ -1020,9 +1049,14 @@ class InstallerWindow::Impl final : public DuiLib::WindowImplBase {
                    LPARAM,
                    BOOL& handled) override {
     handled = TRUE;
+    system_frame_ = ApplyModernCorners(m_hWnd);
     LONG style = GetWindowLongW(m_hWnd, GWL_STYLE);
+    style &= ~WS_CAPTION;
+    if (system_frame_) {
+      style |= WS_CAPTION | WS_THICKFRAME;
+    }
     SetWindowLongW(m_hWnd, GWL_STYLE,
-                   (style & ~WS_CAPTION) | WS_CLIPSIBLINGS | WS_CLIPCHILDREN);
+                   style | WS_CLIPSIBLINGS | WS_CLIPCHILDREN);

     m_pm.Init(m_hWnd);
     const HMONITOR monitor =
@@ -1042,10 +1076,26 @@ class InstallerWindow::Impl final : public DuiLib::WindowImplBase {
     return 0;
   }

+  LRESULT OnSize(UINT message,
+                 WPARAM wparam,
+                 LPARAM lparam,
+                 BOOL& handled) override {
+    if (!system_frame_) {
+      return WindowImplBase::OnSize(message, wparam, lparam, handled);
+    }
+    // A window region prevents DWM from rounding the system frame.
+    handled = FALSE;
+    return 0;
+  }
+
   LRESULT OnClose(UINT,
                   WPARAM,
                   LPARAM,
                   BOOL& handled) override {
+    if (operation_cancel_locked_ && IsOperationPage()) {
+      handled = TRUE;
+      return 0;
+    }
     if (ShouldConfirmExit()) {
       QueuePageTransition(kShowExitConfirmation);
       handled = TRUE;
@@ -1079,6 +1129,13 @@ class InstallerWindow::Impl final : public DuiLib::WindowImplBase {
   LRESULT HandleMessage(UINT message,
                         WPARAM wparam,
                         LPARAM lparam) override {
+    if (message == kPrepareCommit) {
+      return static_cast<LRESULT>(PrepareCommitOnUiThread());
+    }
+    if (message == kShutdownWindow) {
+      DestroyWindow(m_hWnd);
+      return 0;
+    }
     if (message == kShowExitConfirmation) {
       page_transition_pending_ = false;
       ShowExitConfirmation();
@@ -1141,6 +1198,10 @@ class InstallerWindow::Impl final : public DuiLib::WindowImplBase {
       return;
     }
     const DuiLib::CDuiString name = message.pSender->GetName();
+    if (operation_cancel_locked_ &&
+        (name == L"closebtn" || name == L"cancel")) {
+      return;
+    }
     if (name == L"closebtn") {
       if (ShouldConfirmExit()) {
         QueuePageTransition(kShowExitConfirmation);
@@ -1219,10 +1280,51 @@ class InstallerWindow::Impl final : public DuiLib::WindowImplBase {
   }

  private:
+  static BOOL CALLBACK LoadHostIcons(HMODULE module,
+                                    LPCWSTR,
+                                    LPWSTR name,
+                                    LONG_PTR parameter) {
+    auto* self = reinterpret_cast<Impl*>(parameter);
+    const UINT dpi = GetDpiForWindow(self->m_hWnd);
+    const int large_size = MulDiv(32, dpi, 96);
+    const int small_size = MulDiv(16, dpi, 96);
+    self->large_icon_ = static_cast<HICON>(LoadImageW(
+        module, name, IMAGE_ICON, large_size, large_size, LR_DEFAULTCOLOR));
+    self->small_icon_ = static_cast<HICON>(LoadImageW(
+        module, name, IMAGE_ICON, small_size, small_size, LR_DEFAULTCOLOR));
+    if (self->large_icon_ != nullptr) {
+      ::SendMessageW(self->m_hWnd, WM_SETICON, ICON_BIG,
+                     reinterpret_cast<LPARAM>(self->large_icon_));
+    }
+    if (self->small_icon_ != nullptr) {
+      ::SendMessageW(self->m_hWnd, WM_SETICON, ICON_SMALL,
+                     reinterpret_cast<LPARAM>(self->small_icon_));
+    }
+    return self->large_icon_ == nullptr && self->small_icon_ == nullptr;
+  }
+
   enum class InstallScope { current, all };

   static constexpr UINT kShowExitConfirmation = WM_APP + 0x4F4B;
   static constexpr UINT kRestoreSuspendedPage = WM_APP + 0x4F4C;
+  static constexpr UINT kPrepareCommit = WM_APP + 0x4F4D;
+  static constexpr UINT kShutdownWindow = WM_APP + 0x4F4E;
+
+  [[nodiscard]] CommitPreparation PrepareCommitOnUiThread() noexcept {
+    if (event_ == WindowEvent::cancel || event_ == WindowEvent::closed) {
+      return CommitPreparation::cancelled;
+    }
+    if (IsExitConfirmationPage() || page_transition_pending_) {
+      return CommitPreparation::pending;
+    }
+    operation_cancel_locked_ = true;
+    for (const auto* name : {L"cancel", L"closebtn"}) {
+      if (auto* control = m_pm.FindControl(name); control != nullptr) {
+        control->SetEnabled(false);
+      }
+    }
+    return CommitPreparation::ready;
+  }

   [[nodiscard]] bool IsOperationPage() const noexcept {
     return page_name_ == "installing" || page_name_ == "uninstalling";
@@ -1323,7 +1425,7 @@ class InstallerWindow::Impl final : public DuiLib::WindowImplBase {
     button->SetBkColor(selected ? brand_soft : surface);
     button->SetBorderColor(selected ? brand : border);
     button->SetTextColor(text);
-    button->SetFont(selected ? 3 : 0);
+    button->SetFont(0);
     button->SetHotBkColor(selected ? brand_soft : brand_soft);
     button->SetPushedBkColor(selected ? brand_soft : 0xFFE6ECE9);
   }
@@ -1398,11 +1500,15 @@ class InstallerWindow::Impl final : public DuiLib::WindowImplBase {
   ViewState state_;
   std::wstring rendered_xml_;
   std::string error_;
+  HICON large_icon_ = nullptr;
+  HICON small_icon_ = nullptr;
   WindowEvent event_ = WindowEvent::none;
   InstallScope selected_scope_ = InstallScope::current;
   bool advanced_options_visible_ = false;
   bool advanced_options_ever_opened_ = false;
   bool page_transition_pending_ = false;
+  bool operation_cancel_locked_ = false;
+  bool system_frame_ = false;
   bool ready_ = false;
 };

@@ -1493,6 +1599,10 @@ void InstallerWindow::PumpMessages() noexcept {
   }
 }

+CommitPreparation InstallerWindow::PrepareCommit() noexcept {
+  return impl_ ? impl_->PrepareCommit() : CommitPreparation::cancelled;
+}
+
 bool InstallerWindow::SetPage(const std::string& page_name) noexcept {
   return impl_ && impl_->SetPageName(page_name);
 }
diff --git a/tests/renderer_test.cpp b/tests/renderer_test.cpp
index ee96911..42b754b 100644
--- a/tests/renderer_test.cpp
+++ b/tests/renderer_test.cpp
@@ -3,9 +3,125 @@

 #include <cassert>
 #include <filesystem>
+#include <fstream>
+#include <iostream>
 #include <string>

-int main() {
+#include <windows.h>
+
+namespace {
+
+struct FontAvailability {
+  const wchar_t* family;
+  bool installed = false;
+  bool bold = false;
+};
+
+int CALLBACK InspectFont(const LOGFONTW* font,
+                         const TEXTMETRICW*,
+                         DWORD,
+                         LPARAM parameter) {
+  auto& availability = *reinterpret_cast<FontAvailability*>(parameter);
+  availability.installed = true;
+  availability.bold = availability.bold ||
+                      (font->lfWeight == FW_BOLD && font->lfItalic == FALSE);
+  return 1;
+}
+
+FontAvailability InspectInstalledFont(const wchar_t* family) {
+  FontAvailability availability{family};
+  LOGFONTW font{};
+  font.lfCharSet = DEFAULT_CHARSET;
+  wcscpy_s(font.lfFaceName, family);
+  const HDC dc = GetDC(nullptr);
+  if (dc == nullptr) return availability;
+  EnumFontFamiliesExW(dc, &font, InspectFont,
+                     reinterpret_cast<LPARAM>(&availability), 0);
+  ReleaseDC(nullptr, dc);
+  return availability;
+}
+
+bool TestFonts(const nsis_dui::ThemePackage& package,
+               const nsis_dui::ViewState& state) {
+  bool valid = true;
+  const auto check = [&valid](bool condition, const char* message) {
+    if (!condition) {
+      std::cerr << message << '\n';
+      valid = false;
+    }
+  };
+  const auto font_fixture = std::filesystem::temp_directory_path() /
+      ("nsis-dui-font-test-" + std::to_string(GetCurrentProcessId()) + ".xml");
+  {
+    std::ofstream fixture(font_fixture);
+    fixture << "<Font name=\"{{font.family}}\" bold=\"{{font.emphasisBold}}\" />";
+  }
+  auto font_theme = package;
+  font_theme.pages["font-test"] = font_fixture;
+  const struct {
+    const char* locale;
+    const wchar_t* family;
+  } locale_fonts[] = {
+      {"zh-CN", L"Microsoft YaHei UI"},
+      {"zh-HK", L"Microsoft JhengHei UI"},
+      {"zh-TW", L"Microsoft JhengHei UI"},
+      {"ja", L"Yu Gothic UI"},
+      {"ko-KR", L"Malgun Gothic"},
+      {"th-TH", L"Leelawadee UI"},
+      {"hi-IN", L"Nirmala UI"},
+      {"bn", L"Nirmala UI"},
+      {"en-US", L"Segoe UI"},
+      {"ru", L"Segoe UI"},
+  };
+  for (const auto& locale_font : locale_fonts) {
+    font_theme.locale = locale_font.locale;
+    auto expected = InspectInstalledFont(locale_font.family);
+    if (!expected.installed) {
+      expected = InspectInstalledFont(L"Segoe UI");
+    }
+    const auto font_page = nsis_dui::RenderPage(font_theme, "font-test", state);
+    check(static_cast<bool>(font_page), "cannot render font test");
+    if (!font_page) continue;
+    check(font_page.xml->find(L"{{") == std::wstring::npos,
+          "font placeholder was not resolved");
+    if (expected.installed) {
+      const std::wstring expected_xml =
+          L"<Font name=\"" + std::wstring(expected.family) + L"\" bold=\"" +
+          (expected.bold ? L"true" : L"false") + L"\" />";
+      check(*font_page.xml == expected_xml, "wrong locale font or emphasis");
+    }
+    std::wcout << locale_font.locale << L": " << *font_page.xml << L'\n';
+  }
+  // Explicit custom themes retain their font, even for a non-Latin locale.
+  font_theme.locale = "zh-CN";
+  for (const wchar_t* family : {L"Arial", L"Courier New"}) {
+    if (!InspectInstalledFont(family).installed) continue;
+    font_theme.typography.font_family = _wcsicmp(family, L"Arial") == 0
+                                            ? "Arial"
+                                            : "Courier New";
+    const auto custom = nsis_dui::RenderPage(font_theme, "font-test", state);
+    check(static_cast<bool>(custom), "cannot render custom font");
+    if (custom) {
+      check(custom.xml->find(L"name=\"" + std::wstring(family) + L"\"") !=
+                std::wstring::npos,
+            "explicit custom font was overridden");
+    }
+  }
+  // A missing first family must not prevent using an installed later family.
+  font_theme.typography.font_family = "Missing NSIS Test Font, Segoe UI";
+  const auto fallback = nsis_dui::RenderPage(font_theme, "font-test", state);
+  check(static_cast<bool>(fallback), "cannot render missing-font fallback");
+  if (fallback && InspectInstalledFont(L"Segoe UI").installed) {
+    check(fallback.xml->find(L"name=\"Segoe UI\"") != std::wstring::npos,
+          "installed later font was not used");
+  }
+  std::filesystem::remove(font_fixture);
+  return valid;
+}
+
+}  // namespace
+
+int main(int argc, char* argv[]) {
   const std::filesystem::path root =
       std::filesystem::path(NSIS_DUI_SOURCE_DIR) / "themes" / "onekey-modern";
   const auto theme = nsis_dui::LoadTheme(root, "zh-CN");
@@ -19,6 +135,9 @@ int main() {
   state.install_directory = "D:\\Apps\\OneKey";
   state.per_user_install_directory = "D:\\Apps\\OneKey";
   state.per_machine_install_directory = "C:\\Program Files\\OneKey";
+  if (argc > 1 && std::string(argv[1]) == "--fonts") {
+    return TestFonts(*theme.package, state) ? 0 : 1;
+  }
   const auto rendered = nsis_dui::RenderPage(*theme.package, "installing", state);
   assert(rendered);
   assert(rendered.xml->find(L"{{") == std::wstring::npos);
@@ -88,5 +207,6 @@ int main() {
   const auto missing = nsis_dui::RenderPage(*theme.package, "missing", state);
   assert(!missing);
   assert(missing.error.find("does not define page") != std::string::npos);
-  return 0;
+
+  return TestFonts(*theme.package, state) ? 0 : 1;
 }
diff --git a/third_party/duilib/Core/UIManager.cpp b/third_party/duilib/Core/UIManager.cpp
index 8ebdc3b..35fb25a 100644
--- a/third_party/duilib/Core/UIManager.cpp
+++ b/third_party/duilib/Core/UIManager.cpp
@@ -2248,7 +2248,7 @@ namespace DuiLib {
     lf.lfCharSet = DEFAULT_CHARSET;
     lf.lfHeight = -GetDPIObj()->Scale(pFontInfo->iSize);
     lf.lfQuality = CLEARTYPE_QUALITY;
-		if (pFontInfo->bBold) lf.lfWeight += FW_BOLD;
+		lf.lfWeight = pFontInfo->bBold ? FW_BOLD : FW_NORMAL;
     if (pFontInfo->bUnderline) lf.lfUnderline = TRUE;
     if (pFontInfo->bItalic) lf.lfItalic = TRUE;
     HFONT hFont = ::CreateFontIndirect(&lf);
@@ -2798,7 +2798,8 @@ namespace DuiLib {
     }
     lf.lfCharSet = DEFAULT_CHARSET;
     lf.lfHeight = -GetDPIObj()->Scale(nSize);;
-		if( bBold ) lf.lfWeight += FW_BOLD;
+		lf.lfQuality = CLEARTYPE_QUALITY;
+		lf.lfWeight = bBold ? FW_BOLD : FW_NORMAL;
     if( bUnderline ) lf.lfUnderline = TRUE;
     if( bItalic ) lf.lfItalic = TRUE;
     if( bStrikeout ) lf.lfStrikeOut = TRUE;
@@ -2861,7 +2862,8 @@ namespace DuiLib {
     }
     lf.lfCharSet = DEFAULT_CHARSET;
     lf.lfHeight = -GetDPIObj()->Scale(nSize);
-		if( bBold ) lf.lfWeight = FW_BOLD;
+		lf.lfQuality = CLEARTYPE_QUALITY;
+		lf.lfWeight = bBold ? FW_BOLD : FW_NORMAL;
     if( bUnderline ) lf.lfUnderline = TRUE;
     if( bItalic ) lf.lfItalic = TRUE;
     if( bStrikeout ) lf.lfStrikeOut = TRUE;
@@ -4274,4 +4276,4 @@ namespace DuiLib {
   }
 } // namespace DuiLib

-#pragma warning(pop)
\ No newline at end of file
+#pragma warning(pop)
'@
$applyInfo = [System.Diagnostics.ProcessStartInfo]::new('git', 'apply --recount --ignore-space-change')
$applyInfo.UseShellExecute = $false
$applyInfo.RedirectStandardInput = $true
$applyInfo.StandardInputEncoding = [System.Text.UTF8Encoding]::new($false)
$applyProcess = [System.Diagnostics.Process]::Start($applyInfo)
$applyProcess.StandardInput.Write($sourcePatch + "`n")
$applyProcess.StandardInput.Close()
$applyProcess.WaitForExit()
if ($applyProcess.ExitCode -ne 0) { throw 'Source patch failed' }
./scripts/build.ps1 -Configuration Release
```

`PrepareCommit` is an exported NSIS command with no arguments. Call it immediately
before committing staged installation files and pop its one stack result:

- `ok`: cancellation and close controls are locked for the commit.
- `pending`: an exit confirmation or UI transition remains unresolved; retry
  after processing the decision.
- `cancel`: the user confirmed exit or the UI window closed; stop before commit.
- `error:plugin is not initialized`: initialization is missing; do not commit.

`SetPage` resets the operation cancellation lock. The command serializes its
state decision and control updates on the window's UI thread.

Verify the vendored binary:

```powershell
$expected = 'e947164986a86c14398ad73851d6afb0927de065841d93b1bf3ea71fe9627212'
$actual = (Get-FileHash `
  ./apps/desktop/build/nsis-duilib-ui/plugin/x86-unicode/nsis-duilib-ui.dll `
  -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actual -ne $expected) {
  throw "nsis-duilib-ui.dll SHA256 mismatch: $actual"
}
```
