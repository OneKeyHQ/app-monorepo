# nsis-duilib-ui provenance

- Source: https://github.com/huhuanming/nsis-duilib-ui
- Base commit: `a35a32a6c4ec1737296b9e52eca77064492ffd00`
- Local patches: OK-64279, OK-64284, and OK-64289, embedded below; use the system
  frame when DWM accepts rounded corners, otherwise retain DuiLib region
  clipping. Load window icons from the host EXE, including during un.onInit.
  Center the minimize glyph horizontally and vertically in its button.
- Target: Win32/x86 Unicode NSIS plug-in
- Configuration: Release, static MSVC runtime (`/MT`)
- Output: `out/build/windows-x86-ninja/Release/nsis-duilib-ui.dll`
- SHA256: `d3bef96a8132d7fa649f6adc3df6858780f8968d6b3b74a0342e8b008dc68e83`

Build and test from a clean checkout on Windows with Visual Studio 2022,
CMake 3.24 or later, and Ninja:

```powershell
git checkout a35a32a6c4ec1737296b9e52eca77064492ffd00
$sourcePatch = @'
diff --git a/src/window.cpp b/src/window.cpp
index 93c2ca2..b771d4c 100644
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
@@ -1020,9 +1036,14 @@ class InstallerWindow::Impl final : public DuiLib::WindowImplBase {
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
@@ -1042,6 +1063,18 @@ class InstallerWindow::Impl final : public DuiLib::WindowImplBase {
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
@@ -1219,6 +1252,29 @@ class InstallerWindow::Impl final : public DuiLib::WindowImplBase {
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
@@ -1398,11 +1454,14 @@ class InstallerWindow::Impl final : public DuiLib::WindowImplBase {
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
+  bool system_frame_ = false;
   bool ready_ = false;
 };
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

Verify the vendored binary:

```powershell
$expected = 'd3bef96a8132d7fa649f6adc3df6858780f8968d6b3b74a0342e8b008dc68e83'
$actual = (Get-FileHash `
  ./apps/desktop/build/nsis-duilib-ui/plugin/x86-unicode/nsis-duilib-ui.dll `
  -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actual -ne $expected) {
  throw "nsis-duilib-ui.dll SHA256 mismatch: $actual"
}
```
