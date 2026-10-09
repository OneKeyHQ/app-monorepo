# nsis-duilib-ui provenance

- Source: https://github.com/huhuanming/nsis-duilib-ui
- Base commit: `a35a32a6c4ec1737296b9e52eca77064492ffd00`
- Local patch: OK-64279, embedded below; use the system frame when DWM
  accepts rounded corners, otherwise retain DuiLib region clipping.
- Target: Win32/x86 Unicode NSIS plug-in
- Configuration: Release, static MSVC runtime (`/MT`)
- Output: `out/build/windows-x86-ninja/Release/nsis-duilib-ui.dll`
- SHA256: `02605428bcfc38b963f57c93fb8dffea309e9dbff5867962b09c2c237e5c3f37`

Build and test from a clean checkout on Windows with Visual Studio 2022,
CMake 3.24 or later, and Ninja:

```powershell
git checkout a35a32a6c4ec1737296b9e52eca77064492ffd00
$sourcePatch = @'
diff --git a/src/window.cpp b/src/window.cpp
index 93c2ca2..abb9b0f 100644
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
@@ -814,7 +817,11 @@ class InstallerWindow::Impl final : public DuiLib::WindowImplBase {
         return false;
       }
       CenterWindow();
-      ApplyModernCorners(created);
+      if (system_frame_) {
+        SetWindowPos(created, nullptr, 0, 0, 0, 0,
+                     SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER |
+                         SWP_NOACTIVATE | SWP_FRAMECHANGED);
+      }
       return true;
     } catch (const std::exception& error) {
       error_ = error.what();
@@ -1020,9 +1027,14 @@ class InstallerWindow::Impl final : public DuiLib::WindowImplBase {
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
@@ -1042,6 +1054,18 @@ class InstallerWindow::Impl final : public DuiLib::WindowImplBase {
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
@@ -1403,6 +1427,7 @@ class InstallerWindow::Impl final : public DuiLib::WindowImplBase {
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
$expected = '02605428bcfc38b963f57c93fb8dffea309e9dbff5867962b09c2c237e5c3f37'
$actual = (Get-FileHash `
  ./apps/desktop/build/nsis-duilib-ui/plugin/x86-unicode/nsis-duilib-ui.dll `
  -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actual -ne $expected) {
  throw "nsis-duilib-ui.dll SHA256 mismatch: $actual"
}
```
