<#
.SYNOPSIS
  Bootstrap a Windows machine so it can build the OneKey desktop release:
  checks the toolchain (Git / Node / Yarn / Python / MSVC build tools),
  installs JS deps (yarn), and verifies the electron-builder toolchain.

.DESCRIPTION
  Native modules (better-sqlite3 etc.) are compiled on Windows by node-gyp,
  which needs Python + MSVC C++ build tools. This script verifies those are
  present BEFORE running yarn (so failures are explained, not cryptic gyp
  errors), then installs and validates. Run it once per machine / after a
  fresh clone. It is read-only except for the `yarn` install step.

  Order of operations:
    1. Verify Git / Node / Yarn / Python.
    2. Verify MSVC C++ build tools (via vswhere) - node-gyp needs them.
    3. yarn install at the repo root (unless -SkipInstall).
    4. Verify electron-builder is resolvable under apps\desktop.

.PARAMETER RepoPath
  Monorepo root. Default: inferred two levels up from this script.

.PARAMETER SkipInstall
  Only run the toolchain checks; do not run yarn.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\bootstrap-perf-remote-win.ps1
#>
param(
  [string]$RepoPath,
  [switch]$SkipInstall
)

$ErrorActionPreference = 'Stop'
$problems = @()

function Write-Step($n, $msg) { Write-Host "`n[$n] $msg" -ForegroundColor Cyan }
function Ok($msg)   { Write-Host "   OK   $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host "   WARN $msg" -ForegroundColor Yellow }
function Bad($msg)  { Write-Host "   FAIL $msg" -ForegroundColor Red; $script:problems += $msg }

function Get-CmdVersion($cmd, $args) {
  $exe = Get-Command $cmd -ErrorAction SilentlyContinue
  if (-not $exe) { return $null }
  try { return (& $cmd $args 2>$null | Select-Object -First 1) } catch { return '(present)' }
}

# Infer repo root: apps\desktop\scripts -> repo root
if (-not $RepoPath) {
  $RepoPath = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
}
if (-not (Test-Path (Join-Path $RepoPath 'package.json'))) {
  throw "RepoPath '$RepoPath' is not the monorepo root (no package.json). Pass -RepoPath."
}
Write-Host "Repo root: $RepoPath" -ForegroundColor Green

# 1. Core CLIs ------------------------------------------------------------------
Write-Step 1 "Core toolchain (Git / Node / Yarn / Python)"

$git = Get-CmdVersion git '--version'
if ($git) { Ok "git: $git" } else { Bad "git not found - install Git for Windows" }

$node = Get-CmdVersion node '--version'
if ($node) {
  Ok "node: $node"
  # Surface a soft hint if it looks far from the repo's expectation.
  $nvmrc = Join-Path $RepoPath '.nvmrc'
  if (Test-Path $nvmrc) { Warn "repo .nvmrc says: $(Get-Content $nvmrc -First 1) (match major version)" }
} else { Bad "node not found - install Node.js (match the team's version)" }

$yarn = Get-CmdVersion yarn '--version'
if ($yarn) { Ok "yarn: $yarn" } else { Bad "yarn not found - 'corepack enable' or 'npm i -g yarn'" }

# node-gyp wants python3
$py = Get-CmdVersion python '--version'
if (-not $py) { $py = Get-CmdVersion python3 '--version' }
if ($py) { Ok "python: $py" } else { Bad "python not found - node-gyp needs Python 3 (install from python.org or 'winget install Python.Python.3.12')" }

# 2. MSVC C++ build tools -------------------------------------------------------
Write-Step 2 "MSVC C++ build tools (node-gyp compiles native modules)"

$vswhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
if (Test-Path $vswhere) {
  $vc = & $vswhere -latest -products * `
        -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 `
        -property installationPath 2>$null
  if ($vc) {
    Ok "VC++ build tools at: $vc"
  } else {
    Bad "Visual Studio found but the 'Desktop development with C++' workload / VC.Tools is missing. Install it, or 'winget install Microsoft.VisualStudio.2022.BuildTools' with the C++ workload."
  }
} else {
  Bad "No Visual Studio Installer (vswhere) found - install 'Visual Studio Build Tools' with the C++ workload (better-sqlite3 will not compile otherwise)."
}

# 3. Install deps ---------------------------------------------------------------
if ($SkipInstall) {
  Write-Step 3 "yarn install - SKIPPED (-SkipInstall)"
} elseif ($problems.Count -gt 0) {
  Write-Step 3 "yarn install - SKIPPED (fix the toolchain problems above first)"
} else {
  Write-Step 3 "yarn install at repo root (native modules compile here - can take a while)"
  Push-Location $RepoPath
  try {
    yarn
    if ($LASTEXITCODE -ne 0) { Bad "yarn install failed (exit $LASTEXITCODE)" } else { Ok "yarn install complete" }
  } finally { Pop-Location }
}

# 4. Verify electron-builder ----------------------------------------------------
Write-Step 4 "Verify electron-builder toolchain (apps\desktop)"
$ebCandidates = @(
  (Join-Path $RepoPath 'apps\desktop\node_modules\.bin\electron-builder.cmd'),
  (Join-Path $RepoPath 'node_modules\.bin\electron-builder.cmd')
)
$eb = $ebCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if ($eb) {
  Ok "electron-builder present: $eb"
} else {
  if ($SkipInstall) { Warn "electron-builder not found (expected - install was skipped)" }
  else { Bad "electron-builder not found under node_modules\.bin - did yarn install finish?" }
}

# Summary -----------------------------------------------------------------------
Write-Host "`n==================== SUMMARY ====================" -ForegroundColor Green
if ($problems.Count -eq 0) {
  Write-Host "All checks passed. Next:" -ForegroundColor Green
  Write-Host "  1. (admin) scripts\setup-perf-remote-win.ps1   # SSH + share + firewall"
  Write-Host "  2.         scripts\build-launch-perf-win.ps1    # build + launch with debug port"
  Write-Host "  Then drive it from the Mac via development\scripts\windows-perf-build-deploy.sh"
} else {
  Write-Host "Found $($problems.Count) problem(s) - fix before building:" -ForegroundColor Red
  $problems | ForEach-Object { Write-Host "   - $_" -ForegroundColor Red }
  exit 1
}
Write-Host "=================================================" -ForegroundColor Green
