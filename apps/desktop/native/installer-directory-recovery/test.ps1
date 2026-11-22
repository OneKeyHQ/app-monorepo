[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$Helper,

    [switch]$SignedInventories
)

$ErrorActionPreference = 'Stop'
$Helper = (Resolve-Path -LiteralPath $Helper).Path

function Assert-Condition($Condition, [string]$Message) {
    if (-not $Condition) { throw $Message }
}

function Write-Payload([string]$Path, [string]$Content) {
    New-Item -Path (Join-Path $Path 'resources') -ItemType Directory -Force | Out-Null
    foreach ($file in 'OneKey.exe', 'Uninstall OneKey.exe', 'resources\app.asar') {
        [IO.File]::WriteAllText((Join-Path $Path $file), "$Content/$file")
    }
}

function New-Inventory([string]$Payload, [string]$Manifest) {
    $lines = [Collections.Generic.List[string]]::new()
    $lines.Add('onekey-inventory-v1')
    foreach ($item in (Get-ChildItem -LiteralPath $Payload -Recurse -Force)) {
        $relative = $item.FullName.Substring($Payload.Length + 1)
        $value = if ($item.PSIsContainer) {
            'd'
        } else {
            (Get-FileHash -LiteralPath $item.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
        }
        $lines.Add("$value" + [char]9 + $relative)
    }
    [IO.File]::WriteAllText($Manifest, ($lines -join [char]10) + [char]10, [Text.UTF8Encoding]::new($false))
}

function Set-MockRegistration([string]$Scope, [string]$Location, [string]$Version) {
    $scopeKey = Join-Path $registry $Scope
    $installKey = Join-Path $scopeKey 'Install'
    $uninstallKey = Join-Path $scopeKey 'Uninstall'
    New-Item -Path $installKey -Force | Out-Null
    New-Item -Path $uninstallKey -Force | Out-Null
    $mode = if ($Scope -eq 'User') { '/currentuser' } else { '/allusers' }
    Set-ItemProperty -LiteralPath $installKey -Name InstallLocation -Value $Location
    $uninstaller = '"' + (Join-Path $Location 'Uninstall OneKey.exe') + '" ' + $mode
    Set-ItemProperty -LiteralPath $uninstallKey -Name UninstallString -Value $uninstaller
    Set-ItemProperty -LiteralPath $uninstallKey -Name QuietUninstallString -Value "$uninstaller /S"
    Set-ItemProperty -LiteralPath $uninstallKey -Name DisplayVersion -Value $Version
}

function Invoke-Recovery(
    [string]$Command,
    [int]$Expected,
    [string]$Fault = '',
    [string]$Release = '2.0.0',
    [string]$Scope = 'user',
    [string]$Location = $target,
    [string]$OldManifest = $oldInventory,
    [string]$NewManifest = $newInventory,
    [int]$OwnerPid = 0
) {
    $arguments = @(
        $Command, '--scope', $Scope, '--target', $Location, '--release', $Release,
        '--fixture', $token, '--old-inventory', $OldManifest, '--new-inventory', $NewManifest
    )
    if ($Fault) { $arguments += @('--fault', $Fault) }
    if ($OwnerPid) { $arguments += @('--owner-pid', "$OwnerPid") }
    $ErrorActionPreference = 'Continue'
    $PSNativeCommandUseErrorActionPreference = $false
    $output = @(& $Helper @arguments 2>&1)
    if ($LASTEXITCODE -ne $Expected) {
        throw "$Command $Fault returned $LASTEXITCODE instead of $Expected. $output. Arguments: [$($arguments -join ' | ')]"
    }
    if ($Command -eq 'prepare' -and $Expected -eq 0) {
        $newToken = [string]$output[0]
        Assert-Condition ($newToken -cmatch '\A[0-9a-f]{32}\z') "Invalid stage token: $output"
        return $newToken
    }
}

function Start-MockStage([string]$Scope = 'user', [int]$OwnerPid = 0) {
    $stageToken = Invoke-Recovery prepare 0 -Scope $Scope -OwnerPid $OwnerPid
    $script:stage = "$target.new-$stageToken"
    $script:backup = "$target.old-$stageToken"
    Write-Payload $script:stage 'new'
}

function Assert-Original {
    Assert-Condition ((Get-Content -LiteralPath (Join-Path $target 'OneKey.exe') -Raw) -eq 'old/OneKey.exe') 'Original payload was lost'
    Assert-Condition ((Get-Content -LiteralPath $walletData -Raw) -eq 'fixture wallet data') 'External data was modified'
}

function Assert-Promoted {
    Assert-Condition ((Get-Content -LiteralPath (Join-Path $target 'OneKey.exe') -Raw) -eq 'new/OneKey.exe') 'Replacement payload was lost'
    Assert-Condition ((Get-Content -LiteralPath (Join-Path $backup 'OneKey.exe') -Raw) -eq 'old/OneKey.exe') 'Backup payload was lost'
    Assert-Condition ((Get-Content -LiteralPath $walletData -Raw) -eq 'fixture wallet data') 'External data was modified'
}

function Invoke-Fixture([string]$Name, [scriptblock]$Test) {
    $token = [guid]::NewGuid().ToString('N')
    $temp = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
    $root = Join-Path $temp "onekey-recovery-$token"
    $target = Join-Path $root 'OneKey'
    $registry = "HKCU:\Software\OneKeyInstallerRecoveryTests\$token"
    $oldInventory = Join-Path $root 'old.inventory'
    $newInventory = Join-Path $root 'new.inventory'
    $payload = Join-Path $root 'payload'
    $walletData = Join-Path $root 'wallet-data-fixture'
    New-Item -Path $root -ItemType Directory | Out-Null

    try {
        Write-Payload $target 'old'
        Write-Payload $payload 'new'
        New-Inventory $target $oldInventory
        New-Inventory $payload $newInventory
        Set-Content -LiteralPath $walletData -Value 'fixture wallet data' -NoNewline
        Set-MockRegistration User $target '1.0.0'
        & $Test
        Write-Output "PASS $Name"
    } finally {
        $directory = Get-Item -LiteralPath $root -Force
        $expected = [IO.Path]::GetFullPath((Join-Path $temp "onekey-recovery-$token"))
        if ($directory.FullName -ne $expected -or ($directory.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
            throw 'Refusing to clean outside the isolated fixture root.'
        }
        Remove-Item -LiteralPath $directory.FullName -Recurse -Force
        if (Test-Path -LiteralPath $registry) {
            Remove-Item -LiteralPath $registry -Recurse -Force
        }
    }
}

$nativeRegistry = [Microsoft.Win32.RegistryKey]::OpenBaseKey(
    [Microsoft.Win32.RegistryHive]::LocalMachine, [Microsoft.Win32.RegistryView]::Registry64)
try {
    $programFilesKey = $nativeRegistry.OpenSubKey('SOFTWARE\Microsoft\Windows\CurrentVersion')
    try {
        $nativeProgramFiles = $programFilesKey.GetValue('ProgramFilesDir')
        & $Helper verify-machine-root $nativeProgramFiles
        Assert-Condition ($LASTEXITCODE -eq 0) 'x86 helper could not resolve the native Program Files directory'
        Write-Output 'PASS x86 helper resolves 64-bit Program Files'
    } finally {
        $programFilesKey.Dispose()
    }
} finally {
    $nativeRegistry.Dispose()
}

Invoke-Fixture 'normal promotion and checked registry commit' {
    Invoke-Recovery recover 10
    Start-MockStage
    Invoke-Recovery promote 0
    Assert-Promoted
    Invoke-Recovery commit 13
    Invoke-Recovery recover 12
    Invoke-Recovery recover 13 -Release '3.0.0'
    Set-MockRegistration User $target '2.0.0'
    $uninstallKey = Join-Path $registry 'User\Uninstall'
    Remove-ItemProperty -LiteralPath $uninstallKey -Name QuietUninstallString
    Invoke-Recovery commit 13
    Invoke-Recovery recover 12
    Set-MockRegistration User $target '2.0.0'
    Invoke-Recovery commit 0
    Invoke-Recovery recover 10
    Assert-Promoted
}

Invoke-Fixture 'process target authorization is scoped and read-only' {
    $installKey = Join-Path $registry 'User\Install'
    Remove-ItemProperty -LiteralPath $installKey -Name InstallLocation
    Invoke-Recovery check-process-target 10

    Set-MockRegistration User $target '1.0.0'
    Invoke-Recovery check-process-target 0
    Invoke-Recovery check-process-target 13 -Location (Join-Path $root 'payload')

    $legacyTarget = Join-Path $root 'Legacy OneKey'
    Write-Payload $legacyTarget 'legacy'
    Set-MockRegistration User $legacyTarget '1.0.0'
    Invoke-Recovery check-process-target 0 -Location $legacyTarget
    Set-MockRegistration Machine $legacyTarget '1.0.0'
    Invoke-Recovery check-process-target 13 -Location $legacyTarget

    Assert-Condition (!(Test-Path -LiteralPath (Join-Path $registry 'User\Journal'))) 'Process authorization changed the journal'
    Assert-Condition (!(Get-ChildItem -LiteralPath $root -Filter '*.new-*')) 'Process authorization created a stage'
    Assert-Original
}

Invoke-Fixture 'isolated machine scope' {
    $userTarget = Join-Path $root 'OtherOneKey'
    Write-Payload $userTarget 'user'
    Set-MockRegistration User $userTarget '1.0.0'
    Set-MockRegistration Machine $target '1.0.0'
    Start-MockStage -Scope machine
    Invoke-Recovery promote 0 -Scope machine
    Set-MockRegistration Machine $target '2.0.0'
    Invoke-Recovery commit 0 -Scope machine
    Assert-Promoted
    $userExe = Join-Path $userTarget 'OneKey.exe'
    Assert-Condition ((Get-Content -LiteralPath $userExe -Raw) -eq 'user/OneKey.exe') 'Machine upgrade changed user files'
}

foreach ($point in 'before-create-stage', 'after-create-stage', 'after-stage-intent') {
    Invoke-Fixture "interruption at $point" {
        Invoke-Recovery prepare 99 -Fault $point
        Invoke-Recovery recover 11
        Invoke-Recovery recover 10
        Assert-Original
    }
}

foreach ($point in 'before-backup', 'after-backup') {
    Invoke-Fixture "interruption at $point" {
        Start-MockStage
        Invoke-Recovery promote 99 -Fault $point
        Invoke-Recovery recover 11
        Invoke-Recovery recover 10
        Assert-Original
    }
}

foreach ($point in 'after-promote', 'after-promote-intent') {
    Invoke-Fixture "interruption at $point" {
        Start-MockStage
        Invoke-Recovery promote 99 -Fault $point
        Invoke-Recovery recover 12
        Set-MockRegistration User $target '2.0.0'
        Invoke-Recovery commit 0
        Assert-Promoted
    }
}

foreach ($point in 'before-restore', 'after-restore') {
    Invoke-Fixture "interruption at $point" {
        Start-MockStage
        Invoke-Recovery promote 99 -Fault after-backup
        Invoke-Recovery recover 99 -Fault $point
        Invoke-Recovery recover 11
        Invoke-Recovery recover 10
        Assert-Original
    }
}

Invoke-Fixture 'failed promotion immediately restores old payload' {
    Start-MockStage
    Invoke-Recovery promote 11 -Fault fail-promote
    Assert-Original
}

Invoke-Fixture 'failed rollback retains backup and succeeds on retry' {
    Start-MockStage
    Invoke-Recovery promote 99 -Fault after-backup
    Invoke-Recovery recover 13 -Fault fail-restore
    Assert-Condition (-not (Test-Path -LiteralPath $target)) 'Unexpected final path'
    Assert-Condition (Test-Path -LiteralPath $backup) 'Failed restore removed backup'
    Invoke-Recovery recover 11
    Assert-Original
}

Invoke-Fixture 'unexpected final path retains original backup' {
    Start-MockStage
    Invoke-Recovery promote 99 -Fault after-backup
    Write-Payload $target 'unexpected'
    Invoke-Recovery recover 13
    Assert-Condition ((Get-Content -LiteralPath (Join-Path $target 'OneKey.exe') -Raw) -eq 'unexpected/OneKey.exe') 'Unexpected final path was overwritten'
    Assert-Condition (Test-Path -LiteralPath $backup) 'Original backup was removed'
}

Invoke-Fixture 'failed staging leaves old payload registered and in place' {
    Start-MockStage
    Remove-Item -LiteralPath (Join-Path $script:stage 'resources\app.asar')
    Invoke-Recovery promote 13
    Invoke-Recovery recover 11
    Assert-Original
}

Invoke-Fixture 'tampered old content and unlisted files fail closed' {
    Set-Content -LiteralPath (Join-Path $target 'unknown-wallet-data') -Value 'unknown'
    Invoke-Recovery prepare 13
    Invoke-Recovery recover 10
    Remove-Item -LiteralPath (Join-Path $target 'unknown-wallet-data')
    Set-Content -LiteralPath (Join-Path $target 'resources\app.asar') -Value 'tampered'
    Invoke-Recovery prepare 13
    Invoke-Recovery recover 10
    Assert-Original
}

Invoke-Fixture 'changed inventory cannot promote an existing stage' {
    Start-MockStage
    New-Item -ItemType Directory -Path (Join-Path $payload 'unexpected') | Out-Null
    New-Inventory $payload $newInventory
    Invoke-Recovery promote 13
    Invoke-Recovery recover 11
    Assert-Original
}

Invoke-Fixture 'overlapping scope and selected path mismatch' {
    Set-MockRegistration Machine (Join-Path $target 'resources') '1.0.0'
    Invoke-Recovery prepare 13
    Remove-Item -LiteralPath (Join-Path $registry 'Machine') -Recurse
    Set-MockRegistration User (Join-Path $root 'other-target') '1.0.0'
    Invoke-Recovery prepare 13
    Assert-Original
}

Invoke-Fixture 'reparse point does not move target data' {
    $junction = Join-Path $target 'resources\junction'
    New-Item -ItemType Junction -Path $junction -Target $payload | Out-Null
    try {
        New-Inventory $target (Join-Path $root 'reparse.inventory')
        Invoke-Recovery prepare 13 -OldManifest (Join-Path $root 'reparse.inventory')
        Assert-Original
    } finally {
        [IO.Directory]::Delete($junction)
    }
}

Invoke-Fixture 'hard-linked and alternate-stream files fail closed' {
    $entry = Join-Path $target 'resources\app.asar'
    $link = Join-Path $root 'outside-hardlink.asar'
    New-Item -ItemType HardLink -Path $link -Target $entry | Out-Null
    Invoke-Recovery prepare 13
    Remove-Item -LiteralPath $link
    Set-Content -LiteralPath $entry -Stream 'UnknownData' -Value 'fixture alternate data'
    Invoke-Recovery prepare 13
    Assert-Original
}

Invoke-Fixture 'live process lease blocks a second installer' {
    Start-MockStage -OwnerPid $PID
    Invoke-Recovery recover 13
    Invoke-Recovery promote 0 -OwnerPid $PID
    Invoke-Recovery recover 13
    Invoke-Recovery recover 12 -OwnerPid $PID
    Assert-Promoted
}

Invoke-Fixture 'registered path alias and stage overlap block replacement' {
    $alias = Join-Path $root 'scope-alias'
    New-Item -ItemType Junction -Path $alias -Target $target | Out-Null
    try {
        Set-MockRegistration Machine $alias '1.0.0'
        Invoke-Recovery prepare 13
    } finally {
        [IO.Directory]::Delete($alias)
        Remove-Item -LiteralPath (Join-Path $registry 'Machine') -Recurse
    }
    Start-MockStage
    Set-MockRegistration Machine $script:stage '1.0.0'
    Invoke-Recovery promote 13
    Remove-Item -LiteralPath (Join-Path $registry 'Machine') -Recurse
    Invoke-Recovery recover 11
    Assert-Original
}

Invoke-Fixture 'another scope cannot ignore a pending transaction' {
    Start-MockStage
    Invoke-Recovery recover 13 -Scope machine
    Invoke-Recovery recover 11
    Assert-Original
}

Invoke-Fixture 'unsupported paths may use legacy only without a pending transaction' {
    $unsupported = '\\example.invalid\OneKey'
    Invoke-Recovery recover 10 -Location $unsupported
    Invoke-Recovery prepare 10 -Location $unsupported
    Invoke-Recovery enroll 10 -Location $unsupported
    Start-MockStage
    Invoke-Recovery recover 13 -Location $unsupported
    Invoke-Recovery recover 11
    Assert-Original
}

if ($SignedInventories) {
    Add-Type @'
using System.Runtime.InteropServices;
using System.Text;

public static class OneKeyRecoveryFixturePath {
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)]
    public static extern uint GetShortPathName(string path, StringBuilder result, uint capacity);
}
'@
    $toolsDirectory = Join-Path ([IO.Path]::GetTempPath()) ('onekey-signed-inventory-tests-' + [guid]::NewGuid().ToString('N'))
    $signTool = Get-ChildItem -LiteralPath "${env:ProgramFiles(x86)}\Windows Kits\10\bin" -Directory |
        Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName 'x64\signtool.exe') -PathType Leaf } |
        Sort-Object { [version]$_.Name } -Descending | Select-Object -First 1 |
        ForEach-Object { Join-Path $_.FullName 'x64\signtool.exe' }
    if (-not $signTool) { throw 'The Windows SDK x64 SignTool is required for signed inventory tests.' }
    $inventoryModule = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../../scripts/windows-recovery-inventory.js')).Path
    $certificates = @()
    try {
        New-Item -ItemType Directory -Path $toolsDirectory | Out-Null
        foreach ($name in 'Approved', 'Unapproved') {
            $certificates += New-SelfSignedCertificate -Type CodeSigningCert `
                -Subject "CN=OneKey Recovery Fixture $name $([guid]::NewGuid().ToString('N'))" `
                -CertStoreLocation 'Cert:\CurrentUser\My'
        }
        $certificatePath = Join-Path $toolsDirectory 'fixture.cer'
        Export-Certificate -Cert $certificates[0] -FilePath $certificatePath | Out-Null
        & "$PSScriptRoot/build.ps1" -OutputDirectory $toolsDirectory -TestBuild -TestPublisherCertificate $certificatePath
        $signedHelper = Join-Path $toolsDirectory 'OneKeyInstallerDirectoryRecovery.exe'
        $template = Join-Path $toolsDirectory 'OneKeyInstallerInventoryTemplate.bin'

        function New-SignedInventory([string]$Payload, [string]$Output, [string]$Release, [int]$Signer = 0) {
            $buildInventory = @'
const { prepareWindowsRecoveryInventory } = require(process.argv[1]);
const [appOutDir, uninstallerPath, outputPath, release, templatePath] = process.argv.slice(2);
prepareWindowsRecoveryInventory({ appOutDir, uninstallerPath, uninstallerFilename: 'Uninstall OneKey.exe', outputPath, release, templatePath })
  .catch((error) => { console.error(error); process.exitCode = 1; });
'@
            # The app archive omits the uninstaller, which is signed separately.
            $uninstaller = "$Payload-uninstaller.exe"
            Move-Item -LiteralPath (Join-Path $Payload 'Uninstall OneKey.exe') -Destination $uninstaller
            try {
                & node --eval $buildInventory $inventoryModule $Payload $uninstaller $Output $Release $template
                Assert-Condition ($LASTEXITCODE -eq 0) 'Failed to build PE inventory carrier'
            } finally {
                Move-Item -LiteralPath $uninstaller -Destination (Join-Path $Payload 'Uninstall OneKey.exe')
            }
            & $signTool sign /fd sha256 /s My /sha1 $certificates[$Signer].Thumbprint $Output | Out-Null
            Assert-Condition ($LASTEXITCODE -eq 0) 'Failed to sign PE inventory carrier'
        }

        function Invoke-SignedRecovery([string]$Command, [int]$Expected, [string]$Scope = 'user',
                                       [string]$Release = '2.0.0', [string]$Inventory = $nextCarrier,
                                       [string]$Fault = '', [string]$Location = $target) {
            $arguments = @(
                $Command, '--scope', $Scope, '--target', $Location, '--release', $Release,
                '--fixture', $token, '--new-inventory', $Inventory
            )
            if ($Fault) { $arguments += @('--fault', $Fault) }
            $ErrorActionPreference = 'Continue'
            $PSNativeCommandUseErrorActionPreference = $false
            $output = @(& $signedHelper @arguments 2>&1)
            Assert-Condition ($LASTEXITCODE -eq $Expected) "$Command returned $LASTEXITCODE instead of $Expected. $output"
            if ($Command -eq 'prepare' -and $Expected -eq 0) {
                $stageToken = [string]$output[0]
                Assert-Condition ($stageToken -cmatch '\A[0-9a-f]{32}\z') "Invalid stage token: $output"
                return $stageToken
            }
        }

        Invoke-Fixture 'signed enrollment and interrupted replacement' {
            $oldCarrier = Join-Path $root 'old.dll'
            $nextCarrier = Join-Path $root 'next.dll'
            $carrierName = 'OneKeyInstallerInventory.dll'
            $installedCarrier = Join-Path $target $carrierName
            New-SignedInventory $target $oldCarrier '1.0.0'
            New-SignedInventory $payload $nextCarrier '2.0.0'

            $tampered = Join-Path $root 'tampered.dll'
            $carrier = [IO.File]::ReadAllBytes($nextCarrier)
            $section = [BitConverter]::ToInt32($carrier, 60) + 24 + 224
            $dataStart = [BitConverter]::ToInt32($carrier, $section + 20)
            $carrier[$dataStart + 5] = $carrier[$dataStart + 5] -bxor 1
            [IO.File]::WriteAllBytes($tampered, $carrier)

            Invoke-SignedRecovery prepare 10
            Invoke-SignedRecovery prepare 13 -Inventory $tampered
            $redirect = Join-Path $root 'other-location'
            Invoke-SignedRecovery prepare 10 -Location $redirect
            $registration = Join-Path $registry 'User\Install'
            Remove-ItemProperty -LiteralPath $registration -Name InstallLocation
            Invoke-SignedRecovery prepare 10
            Invoke-SignedRecovery prepare 13 -Inventory $tampered
            Set-MockRegistration User $target '1.0.0'

            Copy-Item -LiteralPath $oldCarrier -Destination $installedCarrier
            $shortName = [Text.StringBuilder]::new(4096)
            $length = [OneKeyRecoveryFixturePath]::GetShortPathName($oldCarrier, $shortName, $shortName.Capacity)
            if ($length -and $length -lt $shortName.Capacity -and $shortName.ToString() -ine $oldCarrier) {
                Invoke-SignedRecovery enroll 0 -Release '1.0.0' -Inventory $shortName.ToString()
                Write-Output 'PASS signed inventory via Windows short path'
            } else {
                Write-Output 'SKIP signed inventory short path unavailable on this volume'
                Invoke-SignedRecovery enroll 0 -Release '1.0.0' -Inventory $oldCarrier
            }
            Invoke-SignedRecovery prepare 13 -Location $redirect
            Remove-ItemProperty -LiteralPath $registration -Name InstallLocation
            Invoke-SignedRecovery prepare 13
            Set-MockRegistration User $target '1.0.0'
            Remove-Item -LiteralPath $installedCarrier
            Invoke-SignedRecovery prepare 13
            Copy-Item -LiteralPath $oldCarrier -Destination $installedCarrier
            Invoke-SignedRecovery prepare 13 -Release '3.0.0'
            Invoke-SignedRecovery prepare 13 -Inventory $tampered

            $unapproved = Join-Path $root 'unapproved.dll'
            New-SignedInventory $payload $unapproved '2.0.0' -Signer 1
            Invoke-SignedRecovery prepare 13 -Inventory $unapproved

            $stageToken = Invoke-SignedRecovery prepare 0
            $stage = "$target.new-$stageToken"
            $backup = "$target.old-$stageToken"
            Write-Payload $stage 'new'
            Copy-Item -LiteralPath $nextCarrier -Destination (Join-Path $stage $carrierName)
            Invoke-SignedRecovery promote 99 -Fault after-backup
            Invoke-SignedRecovery recover 11
            Assert-Original
            Assert-Condition (Test-Path -LiteralPath $installedCarrier) 'Rollback did not restore the carrier'

            $stageToken = Invoke-SignedRecovery prepare 0
            $stage = "$target.new-$stageToken"
            $backup = "$target.old-$stageToken"
            Write-Payload $stage 'new'
            Copy-Item -LiteralPath $nextCarrier -Destination (Join-Path $stage $carrierName)
            Invoke-SignedRecovery promote 99 -Fault after-promote
            Invoke-SignedRecovery recover 13 -Inventory $tampered
            Invoke-SignedRecovery recover 12
            Set-MockRegistration User $target '2.0.0'
            Invoke-SignedRecovery commit 0
            Assert-Promoted

            # Reinstalling the same signed bytes still has two distinct directory IDs.
            $null = Invoke-SignedRecovery prepare 0
            Invoke-SignedRecovery recover 11
            Assert-Promoted

            Remove-Item -LiteralPath $installedCarrier
            Remove-Item -LiteralPath (Join-Path $registry 'User\Install'), (Join-Path $registry 'User\Uninstall') -Recurse
            Set-MockRegistration Machine $target '2.0.0'
            Invoke-SignedRecovery prepare 10 -Scope machine
        }
    } finally {
        foreach ($certificate in $certificates) {
            Remove-Item -LiteralPath "Cert:\CurrentUser\My\$($certificate.Thumbprint)" -DeleteKey
        }
        if (Test-Path -LiteralPath $toolsDirectory) {
            $actual = (Get-Item -LiteralPath $toolsDirectory).FullName
            if ($actual -ne [IO.Path]::GetFullPath($toolsDirectory)) { throw 'Unexpected signed fixture tool directory' }
            Remove-Item -LiteralPath $actual -Recurse -Force
        }
    }
}
