<#
.SYNOPSIS
  Move Windows OpenSSH sshd to a free port (default 2222) when something else
  (e.g. an svchost portproxy) already holds IPv4 0.0.0.0:22, which makes sshd
  bind only IPv6 :: and causes "Connection reset" / banner-exchange timeouts.

.DESCRIPTION
  Idempotent. Run from an ELEVATED PowerShell. It:
    1. Prepends "Port <Port>" to sshd_config (top, so it never lands inside the
       trailing 'Match Group administrators' block) if not already set.
    2. Restarts sshd.
    3. Adds an inbound firewall rule for <Port> on ALL profiles (this network
       is Public, so -Profile Any is required).
    4. Verifies sshd is listening on BOTH 0.0.0.0 and :: on <Port>.

.PARAMETER Port
  Port to move sshd to. Default 2222.

.NOTES
  SCOPE: Local developer perf-lab tooling ONLY. Not referenced by any CI
  workflow or package.json script — it never runs in CI and never ships in any
  product bundle. Run manually, elevated, on a developer-owned Windows box.

  The -Profile Any firewall rule is intentional for a lab box whose Windows
  network category is Public; SSH access stays key/password authenticated. If
  the machine lives on an untrusted network, prefer reclassifying the network
  (Set-NetConnectionProfile -NetworkCategory Private) and scoping the rule to
  -Profile Private,Domain instead of exposing the port on Public.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\fix-sshd-port-win.ps1
#>
param(
  [int]$Port = 2222
)

$ErrorActionPreference = 'Stop'

# --- admin check ---
$id = [Security.Principal.WindowsIdentity]::GetCurrent()
if (-not (New-Object Security.Principal.WindowsPrincipal($id)).IsInRole(
      [Security.Principal.WindowsBuiltInRole]::Administrator)) {
  throw "Run this in an ELEVATED PowerShell (Run as Administrator)."
}

$cfg = "C:\ProgramData\ssh\sshd_config"
if (-not (Test-Path $cfg)) { throw "sshd_config not found at $cfg - is OpenSSH Server installed?" }

# 1. Ensure 'Port <Port>' is set at the very top -------------------------------
Write-Host "[1] Setting sshd Port $Port in $cfg" -ForegroundColor Cyan
$raw = Get-Content $cfg -Raw
if ($raw -match "(?m)^\s*Port\s+$Port\b") {
  Write-Host "    already configured for Port $Port"
} else {
  # Drop any other active (uncommented) Port lines to avoid double-binding 22.
  $cleaned = ($raw -split "`r?`n" | Where-Object { $_ -notmatch '^\s*Port\s+\d+' }) -join "`r`n"
  Set-Content $cfg ("Port $Port`r`n" + $cleaned) -Encoding ascii
  Write-Host "    prepended 'Port $Port'"
}

# 2. Restart sshd ---------------------------------------------------------------
Write-Host "[2] Restarting sshd" -ForegroundColor Cyan
Restart-Service sshd
Start-Sleep -Seconds 1
Write-Host "    sshd: $((Get-Service sshd).Status)"

# 3. Firewall rule (Public network -> -Profile Any) -----------------------------
Write-Host "[3] Allow inbound TCP $Port (all profiles)" -ForegroundColor Cyan
$ruleName = "OpenSSH-$Port"
if (Get-NetFirewallRule -Name $ruleName -ErrorAction SilentlyContinue) {
  Set-NetFirewallRule -Name $ruleName -Enabled True -Profile Any
  Write-Host "    rule '$ruleName' already exists (ensured enabled, profile Any)"
} else {
  New-NetFirewallRule -Name $ruleName -DisplayName "OpenSSH $Port" -Enabled True `
    -Direction Inbound -Protocol TCP -Action Allow -LocalPort $Port -Profile Any | Out-Null
  Write-Host "    created rule '$ruleName'"
}

# 4. Verify listeners -----------------------------------------------------------
Write-Host "[4] Listeners on port ${Port}:" -ForegroundColor Cyan
$listeners = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if (-not $listeners) {
  Write-Host "    NONE - sshd is not listening on $Port. Check sshd_config / Get-WinEvent -LogName OpenSSH/Operational" -ForegroundColor Red
  exit 1
}
$ok4 = $false; $ok6 = $false
foreach ($l in $listeners) {
  $proc = (Get-Process -Id $l.OwningProcess -ErrorAction SilentlyContinue).ProcessName
  Write-Host ("    {0,-8} port {1}  pid {2} ({3})" -f $l.LocalAddress, $l.LocalPort, $l.OwningProcess, $proc)
  if ($l.LocalAddress -eq '0.0.0.0') { $ok4 = $true }
  if ($l.LocalAddress -eq '::')      { $ok6 = $true }
}

Write-Host "`n==================== RESULT ====================" -ForegroundColor Green
if ($ok4) {
  Write-Host "OK: sshd is listening on IPv4 0.0.0.0:$Port - the Mac can connect with:" -ForegroundColor Green
  $ip = (Get-NetIPAddress -AddressFamily IPv4 |
         Where-Object { $_.IPAddress -notlike '169.*' -and $_.IPAddress -ne '127.0.0.1' } |
         Select-Object -ExpandProperty IPAddress) -join ', '
  Write-Host "    ssh -p $Port <user>@<this-ip>     (this machine's IPs: $ip)"
} else {
  Write-Host "WARN: still no IPv4 listener on $Port. Something may hold 0.0.0.0:$Port too - try another port:" -ForegroundColor Yellow
  Write-Host "    powershell -ExecutionPolicy Bypass -File scripts\fix-sshd-port-win.ps1 -Port 2299"
}
Write-Host "===============================================" -ForegroundColor Green
