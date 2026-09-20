$ErrorActionPreference = 'Stop'

$source = Join-Path $PSScriptRoot '../native-modules/onekey-usb-repair'
foreach ($arch in @('x64', 'arm64')) {
  $build = Join-Path $source "build/win-$arch"
  $platform = if ($arch -eq 'arm64') { 'ARM64' } else { 'x64' }
  cmake -S $source -B $build -G 'Visual Studio 17 2022' -A $platform
  if ($LASTEXITCODE -ne 0) { throw "CMake configure failed for $arch" }
  cmake --build $build --config Release --target onekey-usb-repair
  if ($LASTEXITCODE -ne 0) { throw "USB repair helper build failed for $arch" }
  if (-not (Test-Path (Join-Path $build 'Release/onekey-usb-repair.exe'))) {
    throw "USB repair helper output is missing for $arch"
  }
}
