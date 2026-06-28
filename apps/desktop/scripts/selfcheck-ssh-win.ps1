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
    3. Authorize -PublicKey in %ProgramData%\ssh\administrators_authorized_keys
       and apply the strict ACL (SYSTEM + Administrators only) OpenSSH demands,
       otherwise sshd SILENTLY ignores it.
    4. Detect the effective sshd port (sshd -T) and what is actually listening.
    5. (optional) Add Windows Defender exclusions so build:win / OneKey.exe are
       not real-time-scanned (scanning throttles the build and the app).
    6. Print a SUMMARY to paste back to the Mac.

  No AI tooling runs on this machine; the Mac drives everything over SSH.

  REQUIRES: run from an elevated (Administrator) PowerShell.

.PARAMETER PublicKey
  REQUIRED. The SSH public key of the machine that will drive this box, to
  authorize for non-interactive SSH. There is intentionally NO default: this
  writes into the ADMIN authorized_keys (persistent admin login), so the
  operator must explicitly supply the key of the driving machine rather than
  silently authorizing a hardcoded device on every run.

.PARAMETER AddDefenderExclusions
  Also add Defender process/path exclusions for OneKey.exe / electron.exe /
  node.exe and the repo + install dirs.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File apps\desktop\scripts\selfcheck-ssh-win.ps1 -PublicKey "ssh-ed25519 AAAA... you@mac" -AddDefenderExclusions
#>
param(
  # REQUIRED. No default: a hardcoded key here would silently authorize a fixed
  # device for persistent ADMIN SSH on every run (the target is the admin
  # authorized_keys file, not a one-shot session). The operator must explicitly
  # pass the public key of the machine that will drive this box.
  [Parameter(Mandatory = $true)]
  [ValidateNotNullOrEmpty()]
  [string]$PublicKey,
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

Assert-Admin | Out-Null
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

# This script is intentionally admin-only: Windows OpenSSH reads the admin
# authorization file for administrator logins, and the strict ACL on that file is
# the failure mode this self-check is built to fix. Non-admin user key setup
# requires a separate, target-user-aware flow.
$targetFile = $adminFile
Warn "elevated login user '$sshUser' uses administrators_authorized_keys (NOT ~/.ssh/authorized_keys)"

$targetDir = Split-Path $targetFile
if (-not (Test-Path $targetDir)) { New-Item -ItemType Directory -Force -Path $targetDir | Out-Null }
if (-not (Test-Path $targetFile)) { New-Item -ItemType File -Force -Path $targetFile | Out-Null }

# Match on the FULL public key, not just the $keyTag comment. Rotating the key
# while keeping the same comment (e.g. still "mac-onekey-perf") must actually
# replace the stale line — otherwise the old key lingers, the write is silently
# skipped, and the only symptom is a later "Permission denied (publickey)" with
# no hint that this step no-op'd.
$existingLines = @(Get-Content -Path $targetFile -ErrorAction SilentlyContinue)
$normalizedKey = $PublicKey.Trim()
if ($existingLines | Where-Object { $_.Trim() -eq $normalizedKey }) {
  Ok "key '$keyTag' already present (exact match) in $targetFile"
} else {
  # Drop any stale line carrying the same tag (rotated key under the same comment)
  # before appending the new one, so the tag's key actually updates.
  $staleByTag = @($existingLines | Where-Object { $_ -like "*$keyTag*" })
  if ($staleByTag.Count -gt 0) {
    $kept = $existingLines | Where-Object { $_ -notlike "*$keyTag*" }
    Set-Content -Path $targetFile -Value $kept
    Warn "replaced stale key under tag '$keyTag' in $targetFile"
  }
  Add-Content -Path $targetFile -Value $PublicKey
  Ok "added key '$keyTag' to $targetFile"
}

# Strict ACL: the admin file is ignored by sshd unless only SYSTEM + Admins have
# access.
#
# Quote the path: $env:ProgramData is locale-dependent and can contain spaces on
# non-English Windows. Unquoted, icacls would parse only the first token, silently
# fail to apply the ACL, and sshd would then ignore the key file.
#
# Check $LASTEXITCODE: `| Out-Null` swallows icacls' output but does NOT reset the
# native exit code. Without this check a non-path failure (insufficient rights,
# locked handle) would still print a green "OK" while sshd keeps ignoring the key
# file — the operator only sees a later "Permission denied (publickey)" with no
# hint why.
icacls "$adminFile" /inheritance:r /grant 'SYSTEM:F' /grant 'BUILTIN\Administrators:F' | Out-Null
if ($LASTEXITCODE -ne 0) {
  Bad "icacls failed (exit $LASTEXITCODE) — ACL not applied; sshd will ignore the key file"
  throw "icacls failed (exit $LASTEXITCODE)"
}
Ok "applied strict ACL (SYSTEM + Administrators) to admin key file"

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
