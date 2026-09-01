# nsis-duilib-ui provenance

- Source: https://github.com/huhuanming/nsis-duilib-ui
- Commit: `a35a32a6c4ec1737296b9e52eca77064492ffd00`
- Target: Win32/x86 Unicode NSIS plug-in
- Configuration: Release, static MSVC runtime (`/MT`)
- Output: `out/build/windows-x86-ninja/Release/nsis-duilib-ui.dll`
- SHA256: `bf854e031d7ed817286f6b92cb42b080fc0a7fca0f67dc3e2defb8741d7f3245`

Build and test from a clean checkout on Windows with Visual Studio 2022,
CMake 3.24 or later, and Ninja:

```powershell
git checkout a35a32a6c4ec1737296b9e52eca77064492ffd00
./scripts/build.ps1 -Configuration Release
```

Verify the vendored binary:

```powershell
$expected = 'bf854e031d7ed817286f6b92cb42b080fc0a7fca0f67dc3e2defb8741d7f3245'
$actual = (Get-FileHash `
  ./apps/desktop/build/nsis-duilib-ui/plugin/x86-unicode/nsis-duilib-ui.dll `
  -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actual -ne $expected) {
  throw "nsis-duilib-ui.dll SHA256 mismatch: $actual"
}
```
