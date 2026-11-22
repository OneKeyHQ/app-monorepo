# OneKey Windows installer UI

The x86 Unicode NSIS plug-in renders the shared OneKey theme with Win32 and GDI+. NSIS owns elevation, installation, uninstallation, folder selection, and application launch. The native UI reports user events through the existing stack contract. It serializes worker calls on the UI thread and keeps a confirmed cancellation pending until NSIS exits. Static content is cached while the progress strip animates.

CMake compiles the [theme](theme) into the DLL. Keep copy and layout changes in its XML and locale files. The build rejects unrecognized layout elements and template keys. The `Init` export takes the locale and version.

Windows packaging compiles the Win32 renderer and uses it for both installation and uninstallation on supported Windows versions. When all-users scope starts an elevated process, NSIS passes the selected scope and directory to that process. NSIS shows its standard pages when the Win32 DLL cannot load or initialize, or when a cross-build has no prepared renderer.

The native DLL dynamically selects per-monitor DPI awareness v2 where supported and v1 on Windows 10 version 1607. It uses DWM rounding where supported and a window region on older versions.

Build with Visual Studio 2022 and the Windows SDK.

```powershell
$source = 'apps/desktop/native/installer-native-ui'
$build = 'apps/desktop/build/installer-generated/native-ui'
cmake -S $source -B $build -G 'Visual Studio 17 2022' -A Win32
cmake --build $build --config Release
```

Build and exercise the fixture with the desktop project's pinned Unicode NSIS compiler and Windows PowerShell. The fixture runs with user privileges and writes its log and screenshots under its output directory.

```powershell
& $makensis "/DPLUGIN_DIR=$build/Release" "/DOUTPUT_FILE=$build/native-ui-fixture.exe" "$source/test/fixture.nsi"
powershell.exe -NoProfile -File "$source/test/verify.ps1" -Fixture "$build/native-ui-fixture.exe" -EvidenceDirectory "$build/captures"
```

The fixture checks browsing and scope events, keyboard minimize and system restore, returning from declined elevation, progress and commit on the NSIS worker, exit confirmation, a repeated uninstall page transition, and re-showing finish after a failed launch. It captures all 13 pages, all 19 welcome locales, and simulated DPI changes at 100%, 125%, 150%, and 200%. Run on Windows with a desktop session.

For visual acceptance, compare the Win32 captures against the archived baseline using the same page, locale, DPI, window size, and fixture inputs. Keep the captures and interaction logs outside disposable build directories.

Test the packaged installer and uninstaller with an isolated app identity and a disposable payload. A default package should show the `OneKey.NativeInstaller` window. To exercise fallback, build a separate test copy of the DLL whose `Init` returns an error after the native window has been created, or whose `DllMain` rejects process attachment. Both failures should show the standard NSIS pages and allow installation and uninstallation. Confirm the minimum client OS on Windows 10 build 14393. Test the Arm64 package on Windows on Arm. Test all-users scope with a standard user who supplies a different administrator's credentials on the Windows secure desktop.

Some drawing geometry derives from [the earlier installer renderer](https://github.com/huhuanming/nsis-duilib-ui/tree/a35a32a6c4ec1737296b9e52eca77064492ffd00). Its [MIT license](licenses/upstream-renderer-MIT.txt) is embedded in the native DLL.
