<#
.SYNOPSIS
  SSH self-check + Mac-driver key authorization for the OneKey remote perf/repro
  box. Run AFTER setup-perf-remote-win.ps1 (SSH/SMB/firewall) and, if :22 is held
  by a portproxy, fix-sshd-port-win.ps1 (moves sshd to 2222). This script closes
  the one gap those leave open: it installs the Mac's public key into the file
  sshd actually reads, fixes the strict ACLs Windows OpenSSH requires, and prints
  a SUMMARY block (username / port / IP / key fingerprint) to paste back so the
  Mac can connect non-interactively.

.DESCRIPTION
  Steps (all idempotent - safe to re-run):
    1. Assert elevated.
    2. Verify OpenSSH Server installed + sshd running (Automatic).
    3. Authorize -PublicKey in the correct authorized_keys file:
         - admin user -> %ProgramData%\ssh\administrators_authorized_keys
         - non-admin   -> %USERPROFILE%\.ssh\authorized_keys
       and apply the strict ACL (SYSTEM + Administrators only) OpenSSH demands on
       the admin file, otherwise sshd SILENTLY ignores it.
    4. Detect the effective sshd port (sshd -T) and what is actually listening.
    5. (optional) Add Windows Defender exclusions so build:win / OneKey.exe are
       not real-time-scanned (scanning throttles the build and the app).
    6. Print a SUMMARY to paste back to the Mac.

  No AI tooling runs on this machine; the Mac drives everything over SSH.

  REQUIRES: run from an elevated (Administrator) PowerShell.

.PARAMETER PublicKey
  The Mac driver's SSH public key to authorize. Defaults to the mac-onekey-perf
  ed25519 key used for the remote CDP crash-repro workflow. Override if the Mac
  key changes.

.PARAMETER AddDefenderExclusions
  Also add Defender process/path exclusions for OneKey.exe / electron.exe /
  node.exe and the repo + install dirs.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File apps\desktop\scripts\selfcheck-ssh-win.ps1 -AddDefenderExclusions
#>
param(
  [string]$PublicKey = 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIDe3qQ9IY3dn8ORJ0ogfMDvCo+3IRh9z7gsKQCe7Cx2a mac-onekey-perf',
  [switch]$AddDefenderExclusions
)

$ErrorActionPreference = 'Stop'

function Write-Step($n, $msg) { Write-Host "`n[$n] $msg" -ForegroundColor Cyan }
function Ok($msg)   { Write-Host "   OK   $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host "   WARN $msg" -ForegroundColor Yellow }
function Bad($msg)  { Write-Host "   FAIL $msg" -ForegroundColor Red }

function Assert-Admin {
  $id = [Security.Principal.WindowsIdentity]::GetCurrent()
  $p  = New-Object Security.Principal.WindowsPrincipal($id)
  if (-not $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw "This script must run in an ELEVATED PowerShell (Run as Administrator)."
  }
  return $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

$isAdmin = Assert-Admin
$whoami  = (whoami).Trim()
$sshUser = $whoami.Split('\')[-1]

# 1. OpenSSH Server present + running ------------------------------------------
Write-Step 1 "OpenSSH Server"
$cap = Get-WindowsCapability -Online -Name 'OpenSSH.Server*'
if ($cap.State -ne 'Installed') {
  Warn "installing $($cap.Name) ..."
  Add-WindowsCapability -Online -Name $cap.Name | Out-Null
}
Ok "OpenSSH.Server installed"
Set-Service -Name sshd -StartupType Automatic
if ((Get-Service sshd).Status -ne 'Running') { Start-Service sshd }
Ok "sshd $((Get-Service sshd).Status) (Automatic)"

# 2. Authorize the Mac public key ----------------------------------------------
Write-Step 2 "Authorize Mac driver key"
$keyTag = ($PublicKey -split '\s+')[-1]   # trailing comment, e.g. mac-onekey-perf
if (-not $keyTag) { $keyTag = 'mac-driver-key' }

$adminFile = Join-Path $env:ProgramData 'ssh\administrators_authorized_keys'
$userDir   = Join-Path $env:USERPROFILE '.ssh'
$userFile  = Join-Path $userDir 'authorized_keys'

# Which file sshd reads depends on whether the login user is a local admin.
if ($isAdmin) {
  $targetFile = $adminFile
  Warn "login user '$sshUser' is a local Administrator -> sshd reads administrators_authorized_keys (NOT ~/.ssh/authorized_keys)"
} else {
  $targetFile = $userFile
}

$targetDir = Split-Path $targetFile
if (-not (Test-Path $targetDir)) { New-Item -ItemType Directory -Force -Path $targetDir | Out-Null }
if (-not (Test-Path $targetFile)) { New-Item -ItemType File -Force -Path $targetFile | Out-Null }

if (Select-String -Path $targetFile -SimpleMatch $keyTag -Quiet) {
  Ok "key '$keyTag' already present in $targetFile"
} else {
  Add-Content -Path $targetFile -Value $PublicKey
  Ok "added key '$keyTag' to $targetFile"
}

# Strict ACL: the admin file is ignored by sshd unless only SYSTEM + Admins have
# access. The per-user file just needs to be owned/readable by the user (default).
if ($targetFile -eq $adminFile) {
  # Quote the path: $env:ProgramData is locale-dependent and can contain spaces
  # on non-English Windows. Unquoted, icacls would parse only the first token,
  # silently fail to apply the ACL, and sshd would then ignore the key file.
  #
  # Check $LASTEXITCODE: `| Out-Null` swallows icacls' output but does NOT reset
  # the native exit code. Without this check a non-path failure (insufficient
  # rights, locked handle) would still print a green "OK" while sshd keeps
  # ignoring the key file — the operator only sees a later "Permission denied
  # (publickey)" with no hint why.
  icacls "$adminFile" /inheritance:r /grant 'SYSTEM:F' /grant 'BUILTIN\Administrators:F' | Out-Null
  if ($LASTEXITCODE -ne 0) {
    Bad "icacls failed (exit $LASTEXITCODE) — ACL not applied; sshd will ignore the key file"
    throw "icacls failed (exit $LASTEXITCODE)"
  }
  Ok "applied strict ACL (SYSTEM + Administrators) to admin key file"
}

Restart-Service sshd
Ok "sshd restarted"

# 3. Effective config + listening port -----------------------------------------
Write-Step 3 "Effective sshd config + listening port"
$sshdExe = Join-Path $env:SystemRoot 'System32\OpenSSH\sshd.exe'
$effPort = $null; $effPubkey = $null; $effAuthFile = $null
if (Test-Path $sshdExe) {
  $dump = & $sshdExe -T 2>$null
  $effPort     = (($dump | Select-String '^port ')            -replace '^port ', '').Trim() -join ' '
  $effPubkey   = (($dump | Select-String '^pubkeyauthentication ') -replace '^pubkeyauthentication ', '').Trim()
  $effAuthFile = (($dump | Select-String '^authorizedkeysfile ')   -replace '^authorizedkeysfile ', '').Trim()
  Ok "sshd -T: port=$effPort pubkeyauthentication=$effPubkey"
  Ok "authorizedkeysfile=$effAuthFile"
} else {
  Warn "sshd.exe not found at $sshdExe - skipping effective-config dump"
}

# What is actually listening for sshd?
$sshdPids = (Get-Process sshd -ErrorAction SilentlyContinue).Id
$listenPorts = @()
if ($sshdPids) {
  $listenPorts = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
    Where-Object { $sshdPids -contains $_.OwningProcess } |
    Select-Object -ExpandProperty LocalPort -Unique
}
if ($listenPorts) { Ok "sshd listening on port(s): $($listenPorts -join ', ')" }
else { Warn "could not confirm a listening sshd socket (firewall/port?)" }
$port = if ($listenPorts) { ($listenPorts | Select-Object -First 1) } elseif ($effPort) { $effPort } else { 22 }

# 4. Defender exclusions (optional) --------------------------------------------
if ($AddDefenderExclusions) {
  Write-Step 4 "Defender exclusions"
  foreach ($p in 'OneKey.exe', 'electron.exe', 'node.exe') {
    Add-MpPreference -ExclusionProcess $p -ErrorAction SilentlyContinue
  }
  $repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
  foreach ($d in @($repoRoot, (Join-Path $env:LOCALAPPDATA 'Programs\onekey'))) {
    if ($d) { Add-MpPreference -ExclusionPath $d -ErrorAction SilentlyContinue }
  }
  Ok "added Defender process + path exclusions (repo: $repoRoot)"
} else {
  Warn "Defender exclusions NOT added (pass -AddDefenderExclusions to add them; needed so build:win / OneKey.exe aren't real-time scanned)"
}

# 5. Key fingerprint (so the Mac can confirm the right key landed) -------------
$fpr = $null
try {
  $tmp = New-TemporaryFile
  Set-Content -Path $tmp -Value $PublicKey -NoNewline
  $fpr = (& $sshdExe.Replace('sshd.exe','ssh-keygen.exe') -lf $tmp 2>$null)
  Remove-Item $tmp -Force -ErrorAction SilentlyContinue
} catch { $fpr = '(ssh-keygen unavailable)' }

# 6. SUMMARY -------------------------------------------------------------------
$ips = (Get-NetIPAddress -AddressFamily IPv4 |
        Where-Object { $_.IPAddress -notlike '169.*' -and $_.IPAddress -ne '127.0.0.1' } |
        Select-Object -ExpandProperty IPAddress) -join ', '

Write-Host "`n==================== PASTE THIS BACK ====================" -ForegroundColor Green
Write-Host ("ssh-username   : {0}" -f $sshUser)
Write-Host ("whoami         : {0}" -f $whoami)
Write-Host ("ssh-port       : {0}" -f $port)
Write-Host ("lan-ip(s)      : {0}" -f $ips)
Write-Host ("sshd-status    : {0}" -f (Get-Service sshd).Status)
Write-Host ("key-file       : {0}" -f $targetFile)
Write-Host ("key-present    : {0}" -f (Select-String -Path $targetFile -SimpleMatch $keyTag -Quiet))
Write-Host ("key-fingerprint: {0}" -f ($fpr -join ' '))
Write-Host ("mac-connect    : ssh -p {0} {1}@<lan-ip>" -f $port, $sshUser)
Write-Host "========================================================" -ForegroundColor Green
