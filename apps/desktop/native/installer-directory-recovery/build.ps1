[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$OutputDirectory,

    [switch]$TestBuild,

    [string[]]$PublisherCertificate = @(),

    [string]$TestPublisherCertificate = ''
)

$ErrorActionPreference = 'Stop'
if (($TestPublisherCertificate -and -not $TestBuild) -or
    ($TestBuild -and $PublisherCertificate.Count)) {
    throw 'Use only release certificates for production and only test certificates for fixtures.'
}
if (-not $TestBuild) {
    $PublisherCertificate += Join-Path $PSScriptRoot '../../resources/windows/code-signing/onekey-limited.cer'
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
$testDefine = if ($TestBuild) { '/DONEKEY_RECOVERY_TEST' } else { '' }
$pinsOption = ''

# The compiler wrapper contains these paths in literal cmd.exe lines.
foreach ($path in $output, $source, $templateSource, $vcvars) {
    if ($path -match '[%"^\x00-\x1F]|[^\x00-\x7F]') {
        throw 'Use ASCII build paths without quotes, carets, or percent signs.'
    }
}

try {
    if ($PublisherCertificate.Count -or $TestPublisherCertificate) {
        $certificates = if ($TestBuild) { @($TestPublisherCertificate) } else { $PublisherCertificate }
        $pins = foreach ($file in $certificates) {
            $certificate = [Security.Cryptography.X509Certificates.X509Certificate2]::new((Resolve-Path -LiteralPath $file).Path)
            try {
                $sha = [Security.Cryptography.SHA256]::Create()
                try {
                    $digest = [BitConverter]::ToString($sha.ComputeHash($certificate.RawData)).Replace('-', '').ToLowerInvariant()
                    'L"' + $digest + '"'
                } finally {
                    $sha.Dispose()
                }
            } finally {
                $certificate.Dispose()
            }
        }
        ('#define ONEKEY_RECOVERY_PUBLISHERS ' + ($pins -join ', ')) |
            Set-Content -LiteralPath $pinsHeader -Encoding ascii
        $pinsOption = '/FI"' + $pinsHeader + '"'
    }

    # Keep the compiler and vcvars invocation within the same Windows command session.
    @"
@echo off
call "$vcvars"
if errorlevel 1 exit /b 1
cl /nologo /std:c++17 /W4 /WX /EHsc /MT /O2 /D_WIN32_WINNT=0x0A00 $testDefine $pinsOption /Fo"$object" /Fe"$executable" "$source" /link /MANIFEST:EMBED /MANIFESTUAC:"level='asInvoker' uiAccess='false'"
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
    foreach ($file in $commandFile, $pinsHeader) {
        if (Test-Path -LiteralPath $file -PathType Leaf) {
            Remove-Item -LiteralPath $file
        }
    }
}

Get-Item -LiteralPath $executable, $template
