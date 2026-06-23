<#
.SYNOPSIS
  One-time setup that turns this Windows machine into a remote build/perf target
  for a Mac (running Claude) on the SAME LAN. Uses only built-in Windows features
  (OpenSSH Server + SMB file share) so NO AI tooling runs on this machine.

.DESCRIPTION
  Steps (all idempotent - safe to re-run):
    1. Install + start OpenSSH Server   -> Mac can `ssh` in to build & tunnel CDP.
    2. Share the repo folder over SMB   -> Mac mounts it and edits files in place.
    3. Allow SSH (22) on Private LAN    -> firewall rule, private profile only.
    4. git core.autocrlf = false        -> Mac's LF edits don't fight CRLF.

  After this runs, the Mac mounts  \\<this-ip>\<ShareName>  and SSHes to this box.
  The CDP debug port is NOT opened here - it stays on 127.0.0.1 when you launch
  the app via build-launch-perf-win.ps1, and the Mac reaches it through an SSH
  tunnel. Nothing wallet-sensitive is exposed to the LAN.

  REQUIRES: run from an elevated (Administrator) PowerShell.

.PARAMETER RepoPath
  Path to the app-monorepo checkout on this machine. Default: inferred two levels
  up from this script (apps\desktop\scripts -> repo root).

.PARAMETER ShareName
  SMB share name the Mac will mount. Default: app-monorepo.

.PARAMETER ShareUser
  Windows user granted access to the share. Default: the current user.

.EXAMPLE
  # From an elevated PowerShell:
  powershell -ExecutionPolicy Bypass -File scripts\setup-perf-remote-win.ps1
#>
param(
  [string]$RepoPath,
  [string]$ShareName = 'app-monorepo',
  [string]$ShareUser = "$env:USERNAME"
)

$ErrorActionPreference = 'Stop'

function Assert-Admin {
  $id = [Security.Principal.WindowsIdentity]::GetCurrent()
  $p  = New-Object Security.Principal.WindowsPrincipal($id)
  if (-not $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw "This script must run in an ELEVATED PowerShell (Run as Administrator)."
  }
}

function Write-Step($n, $msg) { Write-Host "`n[$n] $msg" -ForegroundColor Cyan }

Assert-Admin

# Infer repo root: apps\desktop\scripts -> apps\desktop -> apps -> repo root
if (-not $RepoPath) {
  $RepoPath = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
}
if (-not (Test-Path (Join-Path $RepoPath 'package.json'))) {
  throw "RepoPath '$RepoPath' does not look like the monorepo root (no package.json). Pass -RepoPath explicitly."
}
Write-Host "Repo root: $RepoPath" -ForegroundColor Green
Write-Host "Share:     \\<this-ip>\$ShareName  (user: $ShareUser)" -ForegroundColor Green

# 1. OpenSSH Server -------------------------------------------------------------
Write-Step 1 "Install + start OpenSSH Server"
$cap = Get-WindowsCapability -Online -Name 'OpenSSH.Server*'
if ($cap.State -ne 'Installed') {
  Add-WindowsCapability -Online -Name $cap.Name | Out-Null
  Write-Host "  installed $($cap.Name)"
} else {
  Write-Host "  already installed"
}
Set-Service -Name sshd -StartupType Automatic
if ((Get-Service sshd).Status -ne 'Running') { Start-Service sshd }
Write-Host "  sshd: $((Get-Service sshd).Status), startup Automatic"

# 2. SMB share of the repo ------------------------------------------------------
Write-Step 2 "Share the repo folder over SMB"
$existing = Get-SmbShare -Name $ShareName -ErrorAction SilentlyContinue
if ($existing) {
  if ($existing.Path -ne $RepoPath) {
    Write-Warning "  share '$ShareName' exists but points to '$($existing.Path)'. Re-creating for '$RepoPath'."
    Remove-SmbShare -Name $ShareName -Force
    New-SmbShare -Name $ShareName -Path $RepoPath -FullAccess $ShareUser | Out-Null
  } else {
    Write-Host "  share '$ShareName' already points to repo"
  }
} else {
  New-SmbShare -Name $ShareName -Path $RepoPath -FullAccess $ShareUser | Out-Null
  Write-Host "  created share '$ShareName'"
}

# 3. Firewall: allow SSH on the Private profile only ----------------------------
Write-Step 3 "Allow SSH (22) on the Private network profile"
$rule = Get-NetFirewallRule -Name 'OpenSSH-Server-In-TCP' -ErrorAction SilentlyContinue
if ($rule) {
  Set-NetFirewallRule -Name 'OpenSSH-Server-In-TCP' -Enabled True -Profile Private
  Write-Host "  enabled built-in OpenSSH firewall rule (Private profile)"
} else {
  New-NetFirewallRule -Name 'OpenSSH-Server-In-TCP' -DisplayName 'OpenSSH Server (sshd)' `
    -Enabled True -Direction Inbound -Protocol TCP -Action Allow -LocalPort 22 -Profile Private | Out-Null
  Write-Host "  created firewall rule for TCP 22 (Private profile)"
}
Write-Warning "  SMB (445) is exposed to the LAN by sharing - keep this machine on a TRUSTED private network only."

# 4. Line endings ---------------------------------------------------------------
Write-Step 4 "Set git core.autocrlf=false on the repo (so Mac LF edits stay clean)"
Push-Location $RepoPath
try {
  git config core.autocrlf false
  Write-Host "  core.autocrlf = $(git config core.autocrlf)"
} finally {
  Pop-Location
}

# Summary -----------------------------------------------------------------------
$ips = (Get-NetIPAddress -AddressFamily IPv4 |
        Where-Object { $_.IPAddress -notlike '169.*' -and $_.IPAddress -ne '127.0.0.1' } |
        Select-Object -ExpandProperty IPAddress) -join ', '
Write-Host "`n==================== DONE ====================" -ForegroundColor Green
Write-Host "This machine's LAN IP(s): $ips"
Write-Host "From the Mac:"
Write-Host "  mount:  mount_smbfs //$ShareUser@<this-ip>/$ShareName ~/win-onekey"
Write-Host "  build:  ssh $ShareUser@<this-ip> `"powershell -ExecutionPolicy Bypass -File $RepoPath\apps\desktop\scripts\build-launch-perf-win.ps1`""
Write-Host "  tunnel: ssh -N -L 9222:127.0.0.1:9222 $ShareUser@<this-ip>"
Write-Host "=============================================" -ForegroundColor Green
