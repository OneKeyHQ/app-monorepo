<#
.SYNOPSIS
  Build a Windows release of OneKey desktop and launch it with the Chromium
  remote-debugging port open, so a remote machine (e.g. a Mac running Claude /
  Playwright / DevTools) can attach over CDP for performance profiling.

.DESCRIPTION
  A Release build intentionally strips the dev-only Chromium switches
  (see app/app.ts: "Dev-only switches - NEVER run in production builds"),
  so --remote-debugging-port is NOT baked in. Electron still honors the switch
  when passed on the command line at launch, which is what this script does
  against the unpacked release exe (build-electron\win-unpacked\OneKey.exe).

  SECURITY: binding to 0.0.0.0 exposes the renderer's full execution context to
  the LAN. This is a wallet. Default bind is 127.0.0.1; reach it from another
  machine via an SSH tunnel, NOT by binding 0.0.0.0. Only ever test with an
  empty / throwaway wallet.

.PARAMETER NoBuild
  Skip the (slow) build and just relaunch the already-built exe.

.PARAMETER Port
  Remote debugging port. Default 9222 (matches dev:main and the repo CDP tools).

.PARAMETER Bind
  Address to bind the debug port to. Default 127.0.0.1 (safe; tunnel to it).
  Use 0.0.0.0 ONLY on a trusted, isolated LAN with a throwaway wallet.

.PARAMETER EnableLogging
  Also pass --enable-logging so Chromium logs land on disk.

.PARAMETER Detach
  Launch the app with Start-Process and return immediately, instead of blocking
  on the foreground process. Used by the Mac-side deploy script so the SSH call
  returns after the build + launch (the app keeps running on Windows).

.PARAMETER TraceStartup
  Record a Chromium STARTUP trace from t=0 (process spawn), covering the browser
  and every renderer spawned during boot. This is the only way to capture the
  earliest ~1-3s of startup, which a CDP "attach-then-record" approach misses.
  Writes a single trace file to build-electron\perf\ and prints its path as
  "TRACE_STARTUP_FILE=<path>" so the Mac-side deploy script can scp it back.

.PARAMETER TraceDuration
  Seconds to record when -TraceStartup is set. Default 30 (covers boot + the
  Home-screen settle window). The file is finalized after this many seconds.

.PARAMETER TraceFormat
  'proto' (default; small, load in ui.perfetto.dev) or 'json' (legacy
  chrome://tracing format; bigger but grep-able).

.PARAMETER TraceCategories
  Chromium trace categories. Default targets a JS flamegraph + main-thread tasks
  + loading, which is what distinguishes "slow boot" from a "render storm".

.PARAMETER TraceFile
  Explicit output path. Defaults to build-electron\perf\startup-<timestamp>.<ext>.

.EXAMPLE
  # Full build, then launch with the debug port on localhost:
  powershell -ExecutionPolicy Bypass -File scripts\build-launch-perf-win.ps1

.EXAMPLE
  # Just relaunch the existing build (no rebuild), expose to LAN, with logs:
  powershell -ExecutionPolicy Bypass -File scripts\build-launch-perf-win.ps1 -NoBuild -Bind 0.0.0.0 -EnableLogging

.EXAMPLE
  # Relaunch (no rebuild) and record a 30s startup trace from t=0:
  powershell -ExecutionPolicy Bypass -File scripts\build-launch-perf-win.ps1 -NoBuild -Detach -TraceStartup
#>
param(
  [switch]$NoBuild,
  [int]$Port = 9222,
  [string]$Bind = '127.0.0.1',
  [switch]$EnableLogging,
  [switch]$Detach,
  [switch]$TraceStartup,
  [int]$TraceDuration = 30,
  [ValidateSet('proto', 'json')]
  [string]$TraceFormat = 'proto',
  [string]$TraceCategories = 'disabled-by-default-v8.cpu_profiler,v8,blink,blink.user_timing,toplevel,sequence_manager,loading',
  [string]$TraceFile = ''
)

$ErrorActionPreference = 'Stop'

# apps/desktop is the parent of this script's folder.
$desktopDir = Split-Path -Parent $PSScriptRoot
Set-Location $desktopDir
Write-Host "[perf] desktop dir: $desktopDir" -ForegroundColor Cyan

if (-not $NoBuild) {
  Write-Host "[perf] building Windows release (yarn build:win) - this takes a while..." -ForegroundColor Cyan
  # build:win = clean:build + build:renderer + build:main + install-app-deps + electron-builder -w
  yarn build:win
  if ($LASTEXITCODE -ne 0) { throw "yarn build:win failed (exit $LASTEXITCODE)" }
}

$exe = Join-Path $desktopDir 'build-electron\win-unpacked\OneKey.exe'
if (-not (Test-Path $exe)) {
  throw "Built exe not found at $exe. Run without -NoBuild first, or check build-electron\."
}

$args = @(
  "--remote-debugging-port=$Port",
  "--remote-debugging-address=$Bind"
)
if ($EnableLogging) {
  $args += @('--enable-logging', '--v=1')
}

if ($TraceStartup) {
  $perfDir = Join-Path $desktopDir 'build-electron\perf'
  New-Item -ItemType Directory -Force -Path $perfDir | Out-Null
  if ([string]::IsNullOrEmpty($TraceFile)) {
    $ext = if ($TraceFormat -eq 'json') { 'json' } else { 'pftrace' }
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $TraceFile = Join-Path $perfDir "startup-$stamp.$ext"
  }
  # Chromium/Electron startup tracing: records from process spawn (t=0) across
  # the browser + every renderer spawned during boot, then writes the file once
  # -trace-startup-duration elapses. The app keeps running afterwards.
  $args += @(
    "--trace-startup=$TraceCategories",
    "--trace-startup-duration=$TraceDuration",
    "--trace-startup-format=$TraceFormat",
    "--trace-startup-file=$TraceFile"
  )
  Write-Host "[perf] startup trace: $TraceDuration s, format=$TraceFormat" -ForegroundColor Yellow
  Write-Host "[perf] cats: $TraceCategories" -ForegroundColor DarkYellow
  # Machine-parseable line for the Mac-side deploy script to scp the file back.
  Write-Host "TRACE_STARTUP_FILE=$TraceFile"
}

Write-Host "[perf] launching: $exe" -ForegroundColor Green
Write-Host "[perf] args: $($args -join ' ')" -ForegroundColor Green
Write-Host "[perf] CDP endpoint will be http://${Bind}:$Port/json (open in a Chromium browser to see targets)" -ForegroundColor Green
if ($Bind -eq '0.0.0.0') {
  Write-Warning "Debug port is bound to ALL interfaces. Anyone on this network can execute code in the renderer. Use a throwaway wallet and shut it down when done."
}

if ($Detach) {
  # Kill any previously-launched instance so the new build takes the debug port.
  Get-Process -Name 'OneKey' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
  Start-Sleep -Milliseconds 500
  Start-Process -FilePath $exe -ArgumentList $args | Out-Null
  Write-Host "[perf] launched detached (pid via Start-Process). SSH session can now return." -ForegroundColor Green
} else {
  & $exe @args
}
