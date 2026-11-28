[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$OutputDirectory,

    [switch]$TestBuild,

    [string[]]$PublisherCertificate = @(),

    [string]$TestPublisherCertificate = '',

    [string[]]$TestHistoricalInventory = @()
)

$ErrorActionPreference = 'Stop'
if ((($TestPublisherCertificate -or $TestHistoricalInventory.Count) -and -not $TestBuild) -or
    ($TestBuild -and $PublisherCertificate.Count)) {
    throw 'Use only release certificates for production and only test certificates for fixtures.'
}
if ($TestHistoricalInventory.Count -and -not $TestPublisherCertificate) {
    throw 'A signed fixture requires an inventory publisher certificate.'
}
$historicalFiles = $TestHistoricalInventory
if (-not $TestBuild) {
    $PublisherCertificate += Join-Path $PSScriptRoot '../../resources/windows/code-signing/onekey-limited.cer'
    $historicalFiles = @(Get-ChildItem -LiteralPath (Join-Path $PSScriptRoot 'historical-inventories') -File -Filter '*.inventory' |
        Sort-Object Name | Select-Object -ExpandProperty FullName)
    if (-not $historicalFiles.Count) { throw 'Production recovery requires the historical installation inventories.' }
}

function Get-Sha256Hex([byte[]]$Bytes) {
    $sha = [Security.Cryptography.SHA256]::Create()
    try {
        [BitConverter]::ToString($sha.ComputeHash($Bytes)).Replace('-', '').ToLowerInvariant()
    } finally {
        $sha.Dispose()
    }
}

function Get-PublisherPins([string[]]$Files) {
    foreach ($file in $Files) {
        $certificate = [Security.Cryptography.X509Certificates.X509Certificate2]::new((Resolve-Path -LiteralPath $file).Path)
        try {
            Get-Sha256Hex $certificate.RawData
        } finally {
            $certificate.Dispose()
        }
    }
}

$vswhere = Join-Path "${env:ProgramFiles(x86)}" 'Microsoft Visual Studio\Installer\vswhere.exe'
$visualStudio = & $vswhere -latest -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
if ($LASTEXITCODE -ne 0 -or -not $visualStudio) {
    throw 'Visual Studio with the MSVC x86/x64 toolset is required.'
}

$output = (New-Item -ItemType Directory -Force -Path $OutputDirectory).FullName
$source = Join-Path $PSScriptRoot 'recovery.cpp'
$templateSource = Join-Path $PSScriptRoot 'inventory-template.cpp'
$executable = Join-Path $output 'OneKeyInstallerDirectoryRecovery.exe'
$object = Join-Path $output 'recovery.obj'
$templateObject = Join-Path $output 'inventory-template.obj'
$template = Join-Path $output 'OneKeyInstallerInventoryTemplate.bin'
$vcvars = Join-Path $visualStudio 'VC\Auxiliary\Build\vcvars32.bat'
$nonce = [guid]::NewGuid().ToString('N')
$commandFile = Join-Path $output "build-recovery-$nonce.cmd"
$pinsHeader = Join-Path $output "trusted-recovery-$nonce.h"
$historicalRc = Join-Path $output "historical-recovery-$nonce.rc"
$historicalRes = Join-Path $output "historical-recovery-$nonce.res"
$temporaryFiles = [Collections.Generic.List[string]]::new()
foreach ($file in $commandFile, $pinsHeader, $historicalRc, $historicalRes) { $temporaryFiles.Add($file) }
$testDefine = if ($TestBuild) { '/DONEKEY_RECOVERY_TEST' } else { '' }
$pinsOption = ''
$resourceBuild = ''
$resourceOption = ''

# The compiler wrapper contains these paths in literal cmd.exe lines.
foreach ($path in $output, $source, $templateSource, $vcvars) {
    if ($path -match '[%"^\x00-\x1F]|[^\x00-\x7F]') {
        throw 'Use ASCII build paths without quotes, carets, or percent signs.'
    }
}

try {
    if ($PublisherCertificate.Count -or $TestPublisherCertificate) {
        $certificates = if ($TestBuild) { @($TestPublisherCertificate) } else { $PublisherCertificate }
        $pins = foreach ($pin in (Get-PublisherPins $certificates)) { 'L"' + $pin + '"' }
        ('#define ONEKEY_RECOVERY_PUBLISHERS ' + ($pins -join ', ')) |
            Set-Content -LiteralPath $pinsHeader -Encoding ascii
        $pinsOption = '/FI"' + $pinsHeader + '"'
    }

    if ($historicalFiles.Count) {
        $utf8 = [Text.UTF8Encoding]::new($false, $true)
        $resourceLines = [Collections.Generic.List[string]]::new()
        $metadata = [Collections.Generic.List[string]]::new()
        $identities = @{}
        foreach ($file in $historicalFiles) {
            $path = (Resolve-Path -LiteralPath $file).Path
            $contents = [IO.File]::ReadAllText($path, $utf8).Replace("`r`n", "`n")
            $release = [regex]::Match($contents, '\Aonekey-historical-inventory-v1\n([A-Za-z0-9][A-Za-z0-9._+-]{0,62})\n')
            $program = [regex]::Matches($contents, '(?m)^([0-9a-f]{64})\tOneKey\.exe$')
            $uninstaller = [regex]::Matches($contents, '(?m)^([0-9a-f]{64})\tUninstall OneKey\.exe$')
            if (-not $release.Success -or $program.Count -ne 1 -or $uninstaller.Count -ne 1 -or
                $contents.Contains("`r") -or -not $contents.EndsWith("`n")) {
                throw "Invalid historical installation inventory: $path"
            }
            $bytes = $utf8.GetBytes($contents)
            $digest = Get-Sha256Hex $bytes
            $releaseTag = $release.Groups[1].Value
            $programDigest = $program[0].Groups[1].Value
            $uninstallerDigest = $uninstaller[0].Groups[1].Value
            # Only the standalone ARM64 package lacked APP_64 and used the x86 Program Files default.
            $arm64LegacyDefault = if ($releaseTag -in '6.6.3', '6.6.4' -and
                [IO.Path]::GetFileName($path) -ceq "$releaseTag-win-arm64-arm64.inventory") {
                'true'
            } else {
                'false'
            }
            $identity = "$releaseTag $programDigest $uninstallerDigest"
            $catalogue = "$digest $arm64LegacyDefault"
            if ($identities.ContainsKey($identity)) {
                if ($identities[$identity] -ne $catalogue) { throw "Ambiguous historical installation inventories: $path" }
                continue
            }
            $identities[$identity] = $catalogue
            $id = $metadata.Count + 1
            $binary = Join-Path $output "historical-recovery-$nonce-$id.inventory"
            $temporaryFiles.Add($binary)
            [IO.File]::WriteAllBytes($binary, $bytes)
            $resourceLines.Add(('{0} RCDATA "{1}"' -f $id, $binary.Replace('\', '\\')))
            $metadata.Add(('{{L"{0}", L"{1}", L"{2}", L"{3}", {4}, {5}}}' -f
                $releaseTag, $digest, $programDigest, $uninstallerDigest, $id, $arm64LegacyDefault))
        }
        $resourceLines | Set-Content -LiteralPath $historicalRc -Encoding ascii
        ('#define ONEKEY_RECOVERY_HISTORICAL_INVENTORIES ' + ($metadata -join ', ')) |
            Add-Content -LiteralPath $pinsHeader -Encoding ascii
        $resourceBuild = @"
rc /nologo /fo "$historicalRes" "$historicalRc"
if errorlevel 1 exit /b 1
"@
        $resourceOption = '"' + $historicalRes + '"'
    }

    # Keep the compiler and vcvars invocation within the same Windows command session.
    @"
@echo off
call "$vcvars"
if errorlevel 1 exit /b 1
$resourceBuild
cl /nologo /std:c++17 /W4 /WX /EHsc /MT /O2 /D_WIN32_WINNT=0x0A00 $testDefine $pinsOption /Fo"$object" /Fe"$executable" "$source" $resourceOption /link /MANIFEST:EMBED /MANIFESTUAC:"level='asInvoker' uiAccess='false'"
if errorlevel 1 exit /b 1
cl /nologo /c /std:c++17 /W4 /WX /Zl /Fo"$templateObject" "$templateSource"
if errorlevel 1 exit /b 1
link /nologo /dll /noentry /nodefaultlib /manifest:no /machine:x86 /include:_OneKeyInventoryTemplate /merge:.rdata=.okinv /out:"$template" "$templateObject"
exit /b %errorlevel%
"@ | Set-Content -LiteralPath $commandFile -Encoding ascii

    & $env:ComSpec /d /v:off /c ('"' + $commandFile + '"')
    if ($LASTEXITCODE -ne 0) {
        throw "MSVC exited with code $LASTEXITCODE."
    }
} finally {
    foreach ($file in $temporaryFiles) {
        if (Test-Path -LiteralPath $file -PathType Leaf) {
            Remove-Item -LiteralPath $file
        }
    }
}

Get-Item -LiteralPath $executable, $template
