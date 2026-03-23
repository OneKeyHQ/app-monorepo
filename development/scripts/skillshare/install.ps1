#Requires -Version 5.1
<#
.SYNOPSIS
    Install or upgrade skillshare on Windows.
.DESCRIPTION
    Downloads and installs the latest (or specified) skillshare release from GitHub.
.PARAMETER Version
    Optional. Target version to install (e.g., "v0.17.0" or "0.17.0").
    If omitted, installs the latest release.
.EXAMPLE
    # Install / upgrade to latest
    .\install-skillshare.ps1

    # Install / upgrade to specific version
    .\install-skillshare.ps1 -Version v0.17.0

    # One-liner from remote
    irm https://raw.githubusercontent.com/.../install-skillshare.ps1 | iex
#>

param(
    [string]$Version = ""
)

$ErrorActionPreference = "Stop"

# PowerShell 5.1 defaults to TLS 1.0/1.1; GitHub requires TLS 1.2+
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$Repo       = "runkids/skillshare"
$BinaryName = "skillshare"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
function Write-Info  { param($Message) Write-Host $Message -ForegroundColor Green }
function Write-Warn  { param($Message) Write-Host $Message -ForegroundColor Yellow }
function Write-Err   { param($Message) Write-Host $Message -ForegroundColor Red; exit 1 }
function Write-Step  { param($Message) Write-Host "=> $Message" -ForegroundColor Cyan }

# ---------------------------------------------------------------------------
# Detect architecture
# ---------------------------------------------------------------------------
function Get-Arch {
    $arch = $env:PROCESSOR_ARCHITECTURE
    switch ($arch) {
        "AMD64" { return "amd64" }
        "ARM64" { return "arm64" }
        default { Write-Err "Unsupported architecture: $arch" }
    }
}

# ---------------------------------------------------------------------------
# Get latest version tag (redirect-based, avoids API rate limits)
# ---------------------------------------------------------------------------
function Get-LatestVersion {
    try {
        $response = Invoke-WebRequest -Uri "https://github.com/$Repo/releases/latest" `
            -MaximumRedirection 0 -UseBasicParsing -ErrorAction SilentlyContinue
    } catch {
        $response = $_.Exception.Response
    }

    $location = ""
    if ($response -and $response.Headers -and $response.Headers["Location"]) {
        $location = $response.Headers["Location"]
    }

    if ($location -match "/tag/([^/\s]+)") {
        return $Matches[1]
    }

    # Fallback to API
    try {
        $release = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/releases/latest"
        return $release.tag_name
    } catch {
        Write-Err "Failed to get latest version. Check your internet connection."
    }
}

# ---------------------------------------------------------------------------
# Resolve target version
# ---------------------------------------------------------------------------
function Resolve-TargetVersion {
    if ($Version -ne "") {
        if (-not $Version.StartsWith("v")) {
            $Version = "v$Version"
        }
        Write-Step "Target version: $Version (user-specified)"
        return $Version
    }

    Write-Step "Fetching latest version..."
    $tag = Get-LatestVersion
    Write-Step "Target version: $tag"
    return $tag
}

# ---------------------------------------------------------------------------
# Get / create install directory
# ---------------------------------------------------------------------------
function Get-InstallDir {
    $dir = "$env:LOCALAPPDATA\Programs\skillshare"
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
    return $dir
}

# ---------------------------------------------------------------------------
# Ensure install dir is in user PATH
# ---------------------------------------------------------------------------
function Add-ToPath {
    param($Dir)
    $currentPath = [Environment]::GetEnvironmentVariable("Path", "User")
    if ($currentPath -notlike "*$Dir*") {
        Write-Info "Adding $Dir to PATH..."
        [Environment]::SetEnvironmentVariable("Path", "$currentPath;$Dir", "User")
        $env:Path = "$env:Path;$Dir"
        return $true
    }
    return $false
}

# ---------------------------------------------------------------------------
# Check current installation
# ---------------------------------------------------------------------------
function Get-CurrentVersion {
    $exe = Get-Command $BinaryName -ErrorAction SilentlyContinue
    if ($null -eq $exe) { return $null }
    $output = & $BinaryName version 2>&1
    if ($output -match '(\d+\.\d+\.\d+)') {
        return $Matches[1]
    }
    return $null
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
function Install-Skillshare {
    Write-Host ""
    Write-Info "=== Skillshare Installer / Upgrader (Windows) ==="
    Write-Host ""

    $arch       = Get-Arch
    $tag        = Resolve-TargetVersion
    $versionNum = $tag.TrimStart("v")
    $installDir = Get-InstallDir

    # Check current version
    $currentVer = Get-CurrentVersion
    if ($null -ne $currentVer) {
        Write-Info "Current installed version: v$currentVer"
        if ($currentVer -eq $versionNum) {
            Write-Info "skillshare is already at version v$versionNum. Nothing to do."
            return
        }
        Write-Step "Upgrading from v$currentVer to v$versionNum..."
        $isUpgrade = $true
    } else {
        Write-Step "No existing installation found. Installing fresh..."
        $isUpgrade = $false
    }

    $url = "https://github.com/$Repo/releases/download/$tag/${BinaryName}_${versionNum}_windows_${arch}.zip"
    Write-Step "Downloading skillshare v$versionNum for windows/$arch..."

    # Temp directory
    $tempDir = Join-Path $env:TEMP "skillshare-install-$(Get-Random)"
    New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

    try {
        $zipPath = Join-Path $tempDir "skillshare.zip"

        Invoke-WebRequest -Uri $url -OutFile $zipPath -UseBasicParsing

        Expand-Archive -Path $zipPath -DestinationPath $tempDir -Force

        $exePath = Join-Path $tempDir "$BinaryName.exe"
        if (-not (Test-Path $exePath)) {
            Write-Err "Binary not found in archive."
        }

        $destPath = Join-Path $installDir "$BinaryName.exe"
        Move-Item -Path $exePath -Destination $destPath -Force

        $pathAdded = Add-ToPath -Dir $installDir

        Write-Host ""
        if ($isUpgrade) {
            Write-Info "Successfully upgraded skillshare to v$versionNum!"
        } else {
            Write-Info "Successfully installed skillshare v$versionNum!"
        }
        Write-Host ""

        & $destPath version

        Write-Host ""
        if ($pathAdded) {
            Write-Warn "PATH updated. Restart your terminal for changes to take effect."
            Write-Host ""
        }

        Write-Info "Get started:"
        Write-Info "  skillshare init"
        Write-Info "  skillshare --help"

    } finally {
        Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}

Install-Skillshare
