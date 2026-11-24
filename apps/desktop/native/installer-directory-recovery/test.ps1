[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$Helper,

    [switch]$SignedInventories,

    [string]$JsignJar
)

$ErrorActionPreference = 'Stop'
$Helper = (Resolve-Path -LiteralPath $Helper).Path
if ($JsignJar) {
    if (-not $SignedInventories) { throw '-JsignJar requires -SignedInventories.' }
    $JsignJar = (Resolve-Path -LiteralPath $JsignJar).Path
}

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
    [int]$OwnerPid = 0,
    [string]$UninstallToken = '',
    [string]$InitiatingAppData = ''
) {
    $arguments = @(
        $Command, '--scope', $Scope, '--target', $Location, '--release', $Release,
        '--fixture', $token, '--old-inventory', $OldManifest, '--new-inventory', $NewManifest
    )
    if ($Fault) { $arguments += @('--fault', $Fault) }
    if ($OwnerPid) { $arguments += @('--owner-pid', "$OwnerPid") }
    if ($UninstallToken) { $arguments += @('--token', $UninstallToken) }
    if ($InitiatingAppData) { $arguments += @('--initiating-app-data', $InitiatingAppData) }
    $ErrorActionPreference = 'Continue'
    $PSNativeCommandUseErrorActionPreference = $false
    $output = @(& $Helper @arguments 2>&1)
    if ($LASTEXITCODE -ne $Expected) {
        throw "$Command $Fault returned $LASTEXITCODE instead of $Expected. $output. Arguments: [$($arguments -join ' | ')]"
    }
    if (($Command -in 'prepare', 'uninstall-prepare' -and $Expected -eq 0) -or $Expected -eq 14) {
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
    $retiredFile = Join-Path $backup 'OneKey.exe'
    Assert-Condition ((Get-Content -LiteralPath $retiredFile -Raw) -eq 'old/OneKey.exe') 'Backup payload was lost before commit'
    Invoke-Recovery commit 13
    Invoke-Recovery recover 12
    Invoke-Recovery recover 13 -Release '3.0.0'
    Set-MockRegistration User $target '2.0.0'
    $uninstallKey = Join-Path $registry 'User\Uninstall'
    Remove-ItemProperty -LiteralPath $uninstallKey -Name QuietUninstallString
    Invoke-Recovery commit 13
    Invoke-Recovery recover 12
    Set-MockRegistration User $target '2.0.0'
    (Get-Item -LiteralPath $retiredFile).IsReadOnly = $true
    Invoke-Recovery commit 0
    Assert-Condition (!(Test-Path -LiteralPath $backup)) 'Commit retained its read-only backup'
    Invoke-Recovery recover 10
    Assert-Promoted
}

Invoke-Fixture 'process target authorization is scoped and read-only' {
    $installKey = Join-Path $registry 'User\Install'
    Remove-ItemProperty -LiteralPath $installKey -Name InstallLocation
    Invoke-Recovery check-process-target 13

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

Invoke-Fixture 'unregistered default directory preserves existing files' {
    Remove-Item -LiteralPath (Join-Path $registry 'User\Install'),(Join-Path $registry 'User\Uninstall') -Recurse
    Invoke-Recovery check-process-target 17
    Invoke-Recovery prepare 17
    Assert-Original
    Remove-Item -LiteralPath (Join-Path $target 'OneKey.exe'),(Join-Path $target 'Uninstall OneKey.exe'),(Join-Path $target 'resources\app.asar')
    [IO.Directory]::Delete((Join-Path $target 'resources'))
    Invoke-Recovery check-process-target 10
    [IO.Directory]::Delete($target)
    Invoke-Recovery check-process-target 10
}

Invoke-Fixture 'wallet profile and its parent cannot be installed to or recursively removed' {
    $appData = Join-Path $root 'redirected-profile'
    $walletProfile = Join-Path $appData 'OneKey'
    New-Item -ItemType Directory -Path $walletProfile -Force | Out-Null
    $sentinel = Join-Path $walletProfile 'fixture-wallet'
    [IO.File]::WriteAllText($sentinel, 'wallet data')
    Remove-Item -LiteralPath (Join-Path $registry 'User\Install'),(Join-Path $registry 'User\Uninstall')
    Invoke-Recovery check-process-target 18 -Location $appData -InitiatingAppData $appData
    Set-MockRegistration User $walletProfile '1.0.0'
    Invoke-Recovery check-legacy-uninstall 18 -Location $walletProfile -InitiatingAppData $appData -OwnerPid $PID
    Assert-Condition ((Get-Content -LiteralPath $sentinel -Raw) -eq 'wallet data') 'Wallet profile was modified'
}

Invoke-Fixture 'fresh default install recovers before and after publishing' {
    Remove-Item -LiteralPath (Join-Path $registry 'User\Install'),(Join-Path $registry 'User\Uninstall')
    Remove-Item -LiteralPath (Join-Path $target 'OneKey.exe'),(Join-Path $target 'Uninstall OneKey.exe'),(Join-Path $target 'resources\app.asar')
    [IO.Directory]::Delete((Join-Path $target 'resources'))
    Start-MockStage
    [IO.File]::WriteAllText((Join-Path $stage 'resources\app.asar'), 'partial')
    Invoke-Recovery recover 11
    Assert-Condition (!(Get-ChildItem -LiteralPath $target -Force)) 'Interrupted staging wrote to the default directory'

    Start-MockStage
    Invoke-Recovery promote 99 -Fault after-promote
    Invoke-Recovery recover 12
    Assert-Promoted
    Invoke-Recovery commit 13
    Set-MockRegistration User $target '2.0.0'
    Invoke-Recovery commit 0
    Invoke-Recovery recover 10
    Assert-Promoted
}

Invoke-Fixture 'opposite scope cannot claim a pending cleanup tree' {
    Start-MockStage
    Invoke-Recovery promote 0
    Set-MockRegistration User $target '2.0.0'
    $held = [IO.File]::Open((Join-Path $backup 'OneKey.exe'), 'Open', 'Read', 'Read')
    try {
        Invoke-Recovery commit 0
        Assert-Condition (Test-Path -LiteralPath $backup) 'Commit removed a pinned backup'
    } finally {
        $held.Dispose()
    }
    Invoke-Recovery check-process-target 13 -Scope machine -Location $backup
    Invoke-Recovery check-process-target 13 -Scope machine -Location (Join-Path $backup 'resources')
    Invoke-Recovery check-process-target 13 -Scope machine -Location (Join-Path $backup 'missing\OneKey')
    $separate = "$target.old-$('4' * 32)"
    Write-Payload $separate 'separate'
    Invoke-Recovery check-process-target 10 -Scope machine -Location $separate
    Set-MockRegistration Machine $separate '1.0.0'
    Invoke-Recovery check-process-target 0 -Scope machine -Location $separate
    Invoke-Recovery check-legacy-uninstall 0 -Scope machine -Location $separate -OwnerPid $PID
    [IO.Directory]::Move($backup, "$backup-held")
    try {
        New-Item -ItemType Junction -Path $backup -Target $payload | Out-Null
        try {
            Invoke-Recovery check-process-target 0 -Scope machine -Location $separate
            $alias = Join-Path $root 'pending-cleanup-junction'
            New-Item -ItemType Junction -Path $alias -Target $separate | Out-Null
            try {
                Invoke-Recovery check-process-target 16 -Scope machine -Location $alias
                Invoke-Recovery check-legacy-uninstall 16 -Scope machine -Location $alias -OwnerPid $PID
            } finally {
                [IO.Directory]::Delete($alias)
            }
        } finally {
            [IO.Directory]::Delete($backup)
        }
    } finally {
        [IO.Directory]::Move("$backup-held", $backup)
    }
    foreach ($scope in 'User', 'Machine') {
        Remove-Item -LiteralPath (Join-Path $registry "$scope\Install"),(Join-Path $registry "$scope\Uninstall")
    }
    Invoke-Recovery check-process-target 13 -Scope machine -Location $root
    Assert-Promoted
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

Invoke-Fixture 'fresh and missing ancestor candidates honor other-scope uninstaller registration' {
    $missingTarget = Join-Path $root 'Missing\OneKey'
    Set-MockRegistration Machine $missingTarget '1.0.0'
    Remove-ItemProperty -LiteralPath (Join-Path $registry 'Machine\Install') -Name InstallLocation
    Remove-ItemProperty -LiteralPath (Join-Path $registry 'User\Install') -Name InstallLocation
    Remove-ItemProperty -LiteralPath (Join-Path $registry 'User\Uninstall') -Name UninstallString,QuietUninstallString
    Invoke-Recovery check-process-target 13 -Location $missingTarget
    Invoke-Recovery check-process-target 13 -Location (Join-Path $missingTarget 'Missing\Child')
    Invoke-Recovery check-process-target 10 -Location (Join-Path $root 'Elsewhere\Missing\OneKey')
    Set-MockRegistration User $missingTarget '1.0.0'
    Remove-ItemProperty -LiteralPath (Join-Path $registry 'User\Install') -Name InstallLocation
    Invoke-Recovery check-process-target 13 -Scope machine -Location $missingTarget
    $mismatchedQuiet = '"' + (Join-Path $root 'conflict\Uninstall OneKey.exe') + '" /currentuser /S'
    Set-ItemProperty -LiteralPath (Join-Path $registry 'User\Uninstall') -Name QuietUninstallString -Value $mismatchedQuiet
    Invoke-Recovery check-process-target 13 -Scope machine -Location (Join-Path $root 'Elsewhere\Missing\OneKey')
    Assert-Original
}

Invoke-Fixture 'legacy uninstall guard rejects opposite-scope ARP-only overlap' {
    Invoke-Recovery check-legacy-uninstall 13
    Invoke-Recovery check-legacy-uninstall 0 -OwnerPid $PID
    Set-MockRegistration Machine $target '1.0.0'
    Remove-ItemProperty -LiteralPath (Join-Path $registry 'Machine\Install') -Name InstallLocation
    Invoke-Recovery check-legacy-uninstall 13 -OwnerPid $PID
    Set-MockRegistration Machine $target '1.0.0'
    Remove-ItemProperty -LiteralPath (Join-Path $registry 'User\Install') -Name InstallLocation
    Invoke-Recovery check-legacy-uninstall 13 -OwnerPid $PID -Scope machine
    Remove-ItemProperty -LiteralPath (Join-Path $registry 'User\Uninstall') -Name UninstallString,QuietUninstallString
    Invoke-Recovery check-legacy-uninstall 0 -OwnerPid $PID -Scope machine
    Remove-ItemProperty -LiteralPath (Join-Path $registry 'Machine\Uninstall') -Name QuietUninstallString
    Invoke-Recovery check-legacy-uninstall 13 -OwnerPid $PID -Scope machine
    Assert-Original
}

foreach ($point in 'before-uninstall-rename', 'after-uninstall-rename') {
    Invoke-Fixture "uninstall rollback after $point" {
        Invoke-Recovery enroll 0 -Release '1.0.0' -NewManifest $oldInventory
        Invoke-Recovery uninstall-prepare 99 -Fault $point
        Invoke-Recovery recover 11
        Invoke-Recovery check-process-target 0
        Assert-Condition (!(Get-ChildItem -LiteralPath $root -Filter 'OneKey.uninstall-*')) 'Rollback retained a tombstone'
        Assert-Original
    }
}

Invoke-Fixture 'committed uninstall recovery authenticates worker and drains partial cleanup' {
    Invoke-Recovery uninstall-prepare 10
    Invoke-Recovery enroll 0 -Release '1.0.0' -NewManifest $oldInventory
    Invoke-Recovery uninstall-prepare 99 -Fault after-uninstall-commit
    $uninstallToken = Invoke-Recovery check-process-target 14
    $tombstone = "$target.uninstall-$uninstallToken"
    Assert-Condition ((Get-Content -LiteralPath (Join-Path $tombstone 'OneKey.exe') -Raw) -eq 'old/OneKey.exe') 'Committed uninstall lost original payload'
    Assert-Condition (!(Test-Path -LiteralPath $target)) 'Original target still exists after tombstone commit'
    Invoke-Recovery uninstall-prepare 13 -UninstallToken ('0' * 32)
    $claimedToken = Invoke-Recovery uninstall-prepare 0 -UninstallToken $uninstallToken -OwnerPid $PID
    Assert-Condition ($claimedToken -eq $uninstallToken) 'Claim changed tombstone identity'
    Invoke-Recovery uninstall-finish 13 -OwnerPid $PID
    Remove-ItemProperty -LiteralPath (Join-Path $registry 'User\Install') -Name InstallLocation
    Remove-ItemProperty -LiteralPath (Join-Path $registry 'User\Uninstall') -Name UninstallString,QuietUninstallString
    Invoke-Recovery uninstall-finish 13 -OwnerPid $PID
    Remove-Item -LiteralPath (Join-Path $registry 'User\Install'),(Join-Path $registry 'User\Uninstall')
    Invoke-Recovery uninstall-finish 99 -OwnerPid $PID -Fault during-cleanup
    Assert-Condition (Test-Path -LiteralPath $tombstone) 'Interrupted cleanup removed the tombstone'
    Assert-Condition ((Get-Content -LiteralPath $walletData -Raw) -eq 'fixture wallet data') 'External data was modified'
    Write-Payload $target 'old'
    Set-MockRegistration User $target '1.0.0'
    $untrackedBackup = "$target.old-$('7' * 32)"
    Write-Payload $untrackedBackup 'unknown'
    Start-MockStage
    Assert-Condition (!(Test-Path -LiteralPath $tombstone)) 'Next signed swap retained interrupted cleanup'
    Assert-Condition ((Get-Content -LiteralPath (Join-Path $untrackedBackup 'OneKey.exe') -Raw) -eq 'unknown/OneKey.exe') 'Cleanup modified an unrelated backup'
}

Invoke-Fixture 'machine uninstall resumes after registration keys have been removed' {
    Remove-Item -LiteralPath (Join-Path $registry 'User\Install'),(Join-Path $registry 'User\Uninstall')
    Set-MockRegistration Machine $target '1.0.0'
    Invoke-Recovery enroll 0 -Scope machine -Release '1.0.0' -NewManifest $oldInventory
    $uninstallToken = Invoke-Recovery uninstall-prepare 0 -Scope machine
    Remove-Item -LiteralPath (Join-Path $registry 'Machine\Install'),(Join-Path $registry 'Machine\Uninstall')

    Invoke-Recovery recover 13
    $resumeToken = Invoke-Recovery recover 14 -Scope machine
    Assert-Condition ($resumeToken -eq $uninstallToken) 'Machine recovery lost the existing tombstone'
    $null = Invoke-Recovery uninstall-prepare 0 -Scope machine -UninstallToken $resumeToken -OwnerPid $PID
    Invoke-Recovery uninstall-finish 0 -Scope machine -OwnerPid $PID
    Assert-Condition (!(Test-Path -LiteralPath "$target.uninstall-$resumeToken")) 'Machine recovery retained the tombstone'
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
    Assert-Condition (!(Test-Path -LiteralPath $stage)) 'Rollback retained its verified partial stage'
}

Invoke-Fixture 'rollback retains unexpected staging contents and permits a later cleanup retry' {
    Start-MockStage
    $unknown = Join-Path $stage 'unknown.txt'
    [IO.File]::WriteAllText($unknown, 'preserve me')
    Invoke-Recovery recover 11
    Invoke-Recovery recover 10
    Assert-Original
    Assert-Condition ((Get-Content -LiteralPath $unknown -Raw) -eq 'preserve me') 'Rollback modified unknown files'
    Remove-Item -LiteralPath $unknown
    $null = Invoke-Recovery prepare 0
    Assert-Condition (!(Test-Path -LiteralPath $stage)) 'Next swap retained the previously blocked stage'
    Invoke-Recovery recover 11
}

Invoke-Fixture 'interrupted staging preserves partial files across the next upgrade' {
    Start-MockStage
    $partial = Join-Path $stage 'resources\app.asar'
    [IO.File]::WriteAllText($partial, 'new/')
    Invoke-Recovery recover 11
    Assert-Original

    $nextToken = Invoke-Recovery prepare 0
    Assert-Condition ($stage -ne "$target.new-$nextToken") 'Upgrade reopened the abandoned staging tree'
    Assert-Condition ((Get-Content -LiteralPath $partial -Raw) -eq 'new/') 'Cleanup modified the incomplete file'
    Invoke-Recovery recover 11
    Invoke-Recovery check-process-target 13 -Location $stage
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
    Invoke-Recovery uninstall-prepare 13
    Invoke-Recovery recover 11
    Assert-Original
}

Invoke-Fixture 'unsupported paths may use legacy only without a pending transaction' {
    $unsupported = '\\example.invalid\OneKey'
    Invoke-Recovery check-process-target 16 -Location $unsupported
    Invoke-Recovery check-legacy-uninstall 16 -Location $unsupported -OwnerPid $PID
    Invoke-Recovery recover 10 -Location $unsupported
    Invoke-Recovery prepare 10 -Location $unsupported
    Invoke-Recovery enroll 10 -Location $unsupported
    Start-MockStage
    Invoke-Recovery recover 13 -Location $unsupported
    Invoke-Recovery recover 11
    Assert-Original
}

Invoke-Fixture 'legacy path verification identifies a directory junction' {
    $alias = Join-Path $root 'legacy-junction'
    New-Item -ItemType Junction -Path $alias -Target $target | Out-Null
    try {
        Invoke-Recovery check-process-target 16 -Location $alias
        Invoke-Recovery check-legacy-uninstall 16 -Location $alias -OwnerPid $PID
        Set-MockRegistration Machine $alias '1.0.0'
        Invoke-Recovery check-process-target 16
    } finally {
        [IO.Directory]::Delete($alias)
    }
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
    if (-not $JsignJar) {
        $signTool = Get-ChildItem -LiteralPath "${env:ProgramFiles(x86)}\Windows Kits\10\bin" -Directory |
            Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName 'x64\signtool.exe') -PathType Leaf } |
            Sort-Object { [version]$_.Name } -Descending | Select-Object -First 1 |
            ForEach-Object { Join-Path $_.FullName 'x64\signtool.exe' }
        if (-not $signTool) { throw 'The Windows SDK x64 SignTool is required for signed inventory tests.' }
    }
    $inventoryModule = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../../scripts/windows-recovery-inventory.js')).Path
    $certificates = @()
    try {
        New-Item -ItemType Directory -Path $toolsDirectory | Out-Null
        foreach ($name in 'Approved', 'Unapproved') {
            $certificates += New-SelfSignedCertificate -Type CodeSigningCert `
                -Subject "CN=OneKey Recovery Fixture $name $([guid]::NewGuid().ToString('N'))" `
                -KeyExportPolicy $(if ($JsignJar) { 'Exportable' } else { 'NonExportable' }) `
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
            Sign-FixtureBinary $Output $Signer
        }

        function Sign-FixtureBinary([string]$Output, [int]$Signer = 0) {
            if ($JsignJar) {
                $fixtureKeystore = Join-Path $toolsDirectory "signer-$Signer.pfx"
                $fixturePasswordFile = Join-Path $toolsDirectory "signer-$Signer.txt"
                if (-not (Test-Path -LiteralPath $fixtureKeystore)) {
                    $fixturePassword = [guid]::NewGuid().ToString('N')
                    $securePassword = ConvertTo-SecureString $fixturePassword -AsPlainText -Force
                    [IO.File]::WriteAllText($fixturePasswordFile, $fixturePassword)
                    Export-PfxCertificate -Cert $certificates[$Signer] -FilePath $fixtureKeystore `
                        -Password $securePassword | Out-Null
                }
                & java -jar $JsignJar --storetype PKCS12 --keystore $fixtureKeystore `
                    --storepass "file:$fixturePasswordFile" --alg SHA-256 $Output | Out-Null
            } else {
                & $signTool sign /fd sha256 /s My /sha1 $certificates[$Signer].Thumbprint $Output | Out-Null
            }
            Assert-Condition ($LASTEXITCODE -eq 0) 'Failed to sign fixture binary'
        }

        function Invoke-SignedRecovery([string]$Command, [int]$Expected, [string]$Scope = 'user',
                                       [string]$Release = '2.0.0', [string]$Inventory = $nextCarrier,
                                       [string]$Fault = '', [string]$Location = $target,
                                       [string]$UninstallToken = '', [string]$Worker = '', [int]$OwnerPid = 0) {
            $arguments = @(
                $Command, '--scope', $Scope, '--target', $Location, '--release', $Release,
                '--fixture', $token
            )
            if ($Inventory) { $arguments += @('--new-inventory', $Inventory) }
            if ($Fault) { $arguments += @('--fault', $Fault) }
            if ($UninstallToken) { $arguments += @('--token', $UninstallToken) }
            if ($Worker) { $arguments += @('--worker', $Worker) }
            if ($Command -eq 'run-legacy-uninstaller') { $arguments += @('--keep-shortcuts', '0') }
            if ($OwnerPid) { $arguments += @('--owner-pid', "$OwnerPid") }
            $ErrorActionPreference = 'Continue'
            $PSNativeCommandUseErrorActionPreference = $false
            $output = @(& $signedHelper @arguments 2>&1)
            Assert-Condition ($LASTEXITCODE -eq $Expected) "$Command returned $LASTEXITCODE instead of $Expected. $output"
            if (($Command -in 'prepare', 'uninstall-prepare' -and $Expected -eq 0) -or $Expected -eq 14) {
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
            & $signedHelper verify-inventory '2.0.0' $nextCarrier
            Assert-Condition ($LASTEXITCODE -eq 0) 'Inventory carrier failed the release preflight'

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
            Invoke-SignedRecovery prepare 13
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
            Assert-Condition (!(Test-Path -LiteralPath $stage)) 'Rollback retained the signed staging tree'

            $stageToken = Invoke-SignedRecovery prepare 0
            $stage = "$target.new-$stageToken"
            $backup = "$target.old-$stageToken"
            Write-Payload $stage 'new'
            Copy-Item -LiteralPath $nextCarrier -Destination (Join-Path $stage $carrierName)
            Invoke-SignedRecovery promote 99 -Fault after-promote
            Invoke-SignedRecovery recover 13 -Inventory $tampered
            Invoke-SignedRecovery recover 12
            Set-MockRegistration User $target '2.0.0'
            $otherBackup = "$target.old-$('3' * 32)"
            Write-Payload $otherBackup 'untracked'
            $unknown = Join-Path $backup 'unknown.txt'
            [IO.File]::WriteAllText($unknown, 'preserve me')
            Invoke-SignedRecovery commit 0
            Assert-Promoted
            Invoke-SignedRecovery prepare 13
            Assert-Condition ((Get-Content -LiteralPath $unknown -Raw) -eq 'preserve me') 'Unknown backup file was modified'
            Remove-Item -LiteralPath $unknown
            $junction = Join-Path $backup 'unknown-junction'
            New-Item -ItemType Junction -Path $junction -Target $payload | Out-Null
            try {
                Invoke-SignedRecovery prepare 13
                Assert-Condition ((Get-Item -LiteralPath $junction -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) 'Cleanup changed an unknown reparse point'
                Assert-Condition ((Get-Content -LiteralPath (Join-Path $payload 'OneKey.exe') -Raw) -eq 'new/OneKey.exe') 'Cleanup followed a junction outside the backup'
            } finally {
                [IO.Directory]::Delete($junction)
            }
            Invoke-SignedRecovery prepare 99 -Fault during-cleanup
            $backupCarrier = Join-Path $backup $carrierName
            Assert-Condition (Test-Path -LiteralPath $backupCarrier) 'Partial cleanup removed its authenticated carrier too early'
            Invoke-SignedRecovery prepare 99 -Fault after-cleanup-carrier
            Assert-Condition (Test-Path -LiteralPath $backup) 'Carrier interruption unexpectedly removed backup directory'
            Assert-Condition (!(Get-ChildItem -LiteralPath $backup -Force)) 'Carrier was not the last entry removed'
            $null = Invoke-SignedRecovery prepare 0
            Assert-Condition (!(Test-Path -LiteralPath $backup)) 'Next swap failed to clear empty tracked backup'
            Assert-Condition ((Get-Content -LiteralPath (Join-Path $otherBackup 'OneKey.exe') -Raw) -eq 'untracked/OneKey.exe') 'Unrelated backup was modified'
            Invoke-SignedRecovery recover 11
            Assert-Condition ((Get-Content -LiteralPath (Join-Path $target 'OneKey.exe') -Raw) -eq 'new/OneKey.exe') 'Cleanup changed the current release'

            Remove-Item -LiteralPath $installedCarrier
            Remove-Item -LiteralPath (Join-Path $registry 'User\Install'), (Join-Path $registry 'User\Uninstall') -Recurse
            Set-MockRegistration Machine $target '2.0.0'
            Invoke-SignedRecovery prepare 10 -Scope machine
        }

        Invoke-Fixture 'signed repair permits missing old files and requires an exact incoming tree' {
            $oldCarrier = Join-Path $root 'old.dll'
            $nextCarrier = Join-Path $root 'next.dll'
            $carrierName = 'OneKeyInstallerInventory.dll'
            New-SignedInventory $target $oldCarrier '1.0.0'
            New-SignedInventory $payload $nextCarrier '2.0.0'
            Copy-Item -LiteralPath $oldCarrier -Destination (Join-Path $target $carrierName)
            Invoke-SignedRecovery enroll 0 -Release '1.0.0' -Inventory $oldCarrier
            Remove-Item -LiteralPath (Join-Path $target 'resources\app.asar')

            $stageToken = Invoke-SignedRecovery prepare 0
            $stage = "$target.new-$stageToken"
            Write-Payload $stage 'new'
            Copy-Item -LiteralPath $nextCarrier -Destination (Join-Path $stage $carrierName)
            Remove-Item -LiteralPath (Join-Path $stage 'resources\app.asar')
            Invoke-SignedRecovery promote 13
            Copy-Item -LiteralPath (Join-Path $payload 'resources\app.asar') -Destination (Join-Path $stage 'resources\app.asar')
            Invoke-SignedRecovery promote 0
            Set-MockRegistration User $target '2.0.0'
            Invoke-SignedRecovery commit 0
            Assert-Promoted
        }

        Invoke-Fixture 'legacy machine worker requires the pinned Authenticode publisher' {
            Remove-Item -LiteralPath (Join-Path $registry 'User\Install'),(Join-Path $registry 'User\Uninstall')
            Set-MockRegistration Machine $target '1.0.0'
            $workerDir = Join-Path $root 'worker'
            New-Item -ItemType Directory -Path $workerDir | Out-Null
            $source = Join-Path $target 'Uninstall OneKey.exe'
            foreach ($signer in 1, 0) {
                Copy-Item -LiteralPath $signedHelper -Destination $source -Force
                Sign-FixtureBinary $source $signer
                $worker = Join-Path $workerDir "worker-$signer.exe"
                $result = if ($signer -eq 0) { 99 } else { 13 }
                Invoke-SignedRecovery run-legacy-uninstaller $result -Scope machine -Inventory '' -Worker $worker -Fault legacy-worker-verified
            }
        }

        Invoke-Fixture 'signed uninstall verifies tombstone before returning recovery token' {
            $oldCarrier = Join-Path $root 'old.dll'
            $nextCarrier = $oldCarrier
            $carrierName = 'OneKeyInstallerInventory.dll'
            New-SignedInventory $target $oldCarrier '1.0.0'
            Copy-Item -LiteralPath $oldCarrier -Destination (Join-Path $target $carrierName)
            Invoke-SignedRecovery enroll 0 -Release '1.0.0'
            $uninstallToken = Invoke-SignedRecovery uninstall-prepare 0
            $tombstone = "$target.uninstall-$uninstallToken"
            $executable = Join-Path $tombstone 'Uninstall OneKey.exe'
            $originalExecutable = [IO.File]::ReadAllBytes($executable)
            [IO.File]::WriteAllText($executable, 'changed')
            Invoke-SignedRecovery recover 13
            [IO.File]::WriteAllBytes($executable, $originalExecutable)
            $resumeToken = Invoke-SignedRecovery check-process-target 14
            Assert-Condition ($resumeToken -eq $uninstallToken) 'Authenticated recovery returned different tombstone'
            $worker = Join-Path $root 'copied-uninstaller.exe'
            Copy-Item -LiteralPath $executable -Destination $worker
            Invoke-SignedRecovery verify-uninstall-worker 0 -UninstallToken $uninstallToken -Worker $worker -OwnerPid $PID
            [IO.File]::WriteAllText($worker, 'changed copy')
            Invoke-SignedRecovery verify-uninstall-worker 13 -UninstallToken $uninstallToken -Worker $worker -OwnerPid $PID
            Assert-Condition ((Get-FileHash -LiteralPath $executable).Hash -ne (Get-FileHash -LiteralPath $worker).Hash) 'Worker fixture modified the actual tombstone'
            $resumeToken = Invoke-SignedRecovery recover 14
            Assert-Condition ($resumeToken -eq $uninstallToken) 'Worker verification changed the transaction owner'
            Remove-Item -LiteralPath (Join-Path $registry 'User\Install'),(Join-Path $registry 'User\Uninstall')
            Invoke-SignedRecovery uninstall-finish 0
            Assert-Condition (!(Test-Path -LiteralPath $tombstone)) 'Successful uninstall retained verified payload'
            Assert-Condition ((Get-Content -LiteralPath $walletData -Raw) -eq 'fixture wallet data') 'External data was modified'
        }

        Invoke-Fixture 'signed uninstall proceeds after a staging carrier was only partially copied' {
            $oldCarrier = Join-Path $root 'old.dll'
            $nextCarrier = Join-Path $root 'next.dll'
            $carrierName = 'OneKeyInstallerInventory.dll'
            New-SignedInventory $target $oldCarrier '1.0.0'
            New-SignedInventory $payload $nextCarrier '2.0.0'
            Copy-Item -LiteralPath $oldCarrier -Destination (Join-Path $target $carrierName)
            Invoke-SignedRecovery enroll 0 -Release '1.0.0' -Inventory $oldCarrier

            $stageToken = Invoke-SignedRecovery prepare 0
            $stage = "$target.new-$stageToken"
            $partialCarrier = Join-Path $stage $carrierName
            $carrierBytes = [IO.File]::ReadAllBytes($nextCarrier)
            [IO.File]::WriteAllBytes($partialCarrier, [byte[]]$carrierBytes[0..127])
            $partialHash = (Get-FileHash -LiteralPath $partialCarrier).Hash
            Invoke-SignedRecovery recover 11
            Assert-Original

            $uninstallToken = Invoke-SignedRecovery uninstall-prepare 0 -Inventory ''
            Remove-Item -LiteralPath (Join-Path $registry 'User\Install'),(Join-Path $registry 'User\Uninstall')
            Invoke-SignedRecovery uninstall-finish 0 -Inventory ''
            Assert-Condition (!(Test-Path -LiteralPath "$target.uninstall-$uninstallToken")) 'Uninstall retained its tombstone'
            Assert-Condition ((Get-FileHash -LiteralPath $partialCarrier).Hash -eq $partialHash) 'Cleanup changed the partial carrier'
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
