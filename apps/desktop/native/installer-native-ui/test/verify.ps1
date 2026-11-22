param(
    [Parameter(Mandatory = $true)][string]$Fixture,
    [Parameter(Mandatory = $true)][string]$EvidenceDirectory
)
$ErrorActionPreference = 'Stop'
$Fixture = (Resolve-Path -LiteralPath $Fixture).Path
$null = New-Item -ItemType Directory -Force -Path $EvidenceDirectory
$EvidenceDirectory = (Resolve-Path -LiteralPath $EvidenceDirectory).Path
$log = Join-Path (Split-Path -Parent $Fixture) 'fixture-events.txt'

Add-Type -AssemblyName System.Drawing
Add-Type -Path (Join-Path $PSScriptRoot 'fixture-window.cs')
Add-Type -AssemblyName Accessibility
Add-Type -Path (Join-Path $PSScriptRoot 'fixture-accessibility.cs') -ReferencedAssemblies 'Accessibility'
[FixtureWindow]::UsePhysicalPixels()

function Wait-For($Condition, [string]$Label) {
    $end = [DateTime]::UtcNow.AddSeconds(15)
    do {
        $result = & $Condition
        if ($result) { return $result }
        Start-Sleep -Milliseconds 35
    } while ([DateTime]::UtcNow -lt $end)
    throw "Timed out waiting for $Label"
}

function Wait-Log([string]$Value) {
    $null = Wait-For { (Get-Content -LiteralPath $log -ErrorAction SilentlyContinue) -ccontains $Value } $Value
}

function Click($Window, [int]$X, [int]$Y) {
    $bounds = [FixtureWindow+Rect]::new()
    if (![FixtureWindow]::GetClientRect($Window, [ref]$bounds)) { throw 'Missing native client area' }
    $pixelX = [int]($X * $bounds.Right / 900)
    $pixelY = [int]($Y * $bounds.Bottom / 560)
    $position = [IntPtr](($pixelY -shl 16) -bor $pixelX)
    [FixtureWindow]::Send($Window, 0x0201, [IntPtr]1, $position)
    [FixtureWindow]::Send($Window, 0x0202, [IntPtr]::Zero, $position)
}

function Press-Key($Window, [int]$Key) {
    # Space activates on key-up. The other tested keys activate on key-down
    # and may close the window before a second message can be sent.
    $message = if ($Key -eq 0x20) { 0x0101 } else { 0x0100 }
    [FixtureWindow]::Send($Window, $message, [IntPtr]$Key, [IntPtr]::Zero)
}

function Save-Capture($Window, [string]$Name) {
    $bounds = [FixtureWindow+Rect]::new()
    if (![FixtureWindow]::GetClientRect($Window, [ref]$bounds)) { throw 'Missing native client area' }
    $bitmap = [Drawing.Bitmap]::new($bounds.Right, $bounds.Bottom)
    try {
        $canvas = [Drawing.Graphics]::FromImage($bitmap)
        try {
            $dc = $canvas.GetHdc()
            try {
                if (![FixtureWindow]::PrintWindow($Window, $dc, 1)) { throw "Could not render $Name" }
            } finally {
                $canvas.ReleaseHdc($dc)
            }
        } finally {
            $canvas.Dispose()
        }
        if ($bitmap.GetPixel(20, [int](540 * $bounds.Bottom / 560)).ToArgb() -eq 0) { throw "Empty capture for $Name" }
        $bitmap.Save((Join-Path $EvidenceDirectory "$Name.png"), [Drawing.Imaging.ImageFormat]::Png)
    } finally {
        $bitmap.Dispose()
    }
}

function Run-Fixture([string]$Name, [string[]]$Options, $Test) {
    $process = Start-Process -FilePath $Fixture -ArgumentList $Options -PassThru -WindowStyle Hidden
    try {
        $window = Wait-For {
            $found = [FixtureWindow]::Find($process.Id, 'OneKey.NativeInstaller', $true)
            if ($found -ne [IntPtr]::Zero) { $found }
        } "$Name window visibility"
        Wait-Log 'show=ok'
        if ([FixtureWindow]::Find($process.Id, '#32770', $true) -ne [IntPtr]::Zero) {
            throw "The NSIS host is visible during $Name"
        }
        & $Test $window $process
        if (!$process.WaitForExit(5000)) { throw "Fixture $Name did not exit" }
        Copy-Item -LiteralPath $log -Destination (Join-Path $EvidenceDirectory "$Name.txt")
    } finally {
        if (!$process.HasExited) { Stop-Process -Id $process.Id }
        $process.Dispose()
    }
}

function Close-Fixture($Window) {
    [FixtureWindow]::Send($Window, 0x0010, [IntPtr]::Zero, [IntPtr]::Zero)
    Wait-Log 'event=closed'
}

Run-Fixture 'accessibility' @('/PAGE=welcome', '/MODE=accessibility') {
    param($window, $process)
    Save-Capture $window 'accessible-welcome'
    $root = [FixtureAccessibility]::Root($window)
    [FixtureAccessibility]::CheckRoot($root, 'Install OneKey')
    $null = [FixtureAccessibility]::Find($root, 'By continuing, you agree to the Terms and Privacy Policy', 41)
    $terms = [FixtureAccessibility]::Find($root, 'Terms', 30)
    [FixtureAccessibility]::CheckLocation($root, $terms)
    [FixtureAccessibility]::Invoke($root, $terms)
    Wait-Log 'event=terms'
    $privacy = [FixtureAccessibility]::Find($root, 'Privacy Policy', 30)
    [FixtureAccessibility]::CheckLocation($root, $privacy)
    [FixtureAccessibility]::Invoke($root, $privacy)
    Wait-Log 'event=privacy'
    $more = [FixtureAccessibility]::Find($root, 'More options', 43)
    [FixtureAccessibility]::CheckState($root, $more, 0x400, $true)
    [FixtureAccessibility]::TakeFocus($root, $more)
    [FixtureAccessibility]::Invoke($root, $more)
    [FixtureAccessibility]::CheckRejectedInvocation($root, $more, -2147220995)
    $root = [FixtureAccessibility]::Root($window)
    Save-Capture $window 'accessible-welcome-expanded'
    $fewer = [FixtureAccessibility]::Find($root, 'Fewer options', 43)
    [FixtureAccessibility]::CheckState($root, $fewer, 0x200, $true)
    $current = [FixtureAccessibility]::Find($root, "Only for me  $([char]0xB7)  Recommended", 45)
    $all = [FixtureAccessibility]::Find($root, 'Anyone who uses this PC', 45)
    [FixtureAccessibility]::CheckState($root, $current, 16, $true)
    [FixtureAccessibility]::CheckState($root, $all, 16, $false)
    [FixtureAccessibility]::Invoke($root, $all)
    [FixtureAccessibility]::CheckState($root, $current, 16, $false)
    [FixtureAccessibility]::CheckState($root, $all, 16, $true)
    $change = [FixtureAccessibility]::Find($root, 'Change', 43)
    $directory = [FixtureAccessibility]::Find($root, 'C:\Fixture\All', 41)
    $changes = [FixtureAccessibility+NameChanges]::new($window, $process.Id, $directory)
    try {
        [FixtureAccessibility]::Invoke($root, $change)
        Wait-Log 'directory=ok'
        $null = Wait-For { $changes.Count() } 'accessible directory name change'
        if ([FixtureAccessibility]::Find($root, 'C:\Fixture\Changed', 41) -ne $directory) {
            throw 'The updated directory replaced its accessible child'
        }
        [FixtureAccessibility]::Invoke($root, $change)
        $null = Wait-For {
            @(Get-Content -LiteralPath $log | Where-Object { $_ -ceq 'directory=ok' }).Count -eq 2
        } 'same directory selection'
        if ($changes.Count() -ne 1) { throw 'Unexpected repeated directory name change' }
    } finally {
        $changes.Dispose()
    }
    $primary = [FixtureAccessibility]::Find($root, 'Install', 43)
    [FixtureAccessibility]::Invoke($root, $primary)
    Wait-Log 'event=primary-all'
    Wait-Log 'worker-progress=ok'
    $root = [FixtureAccessibility]::Root($window)
    [FixtureAccessibility]::CheckRoot($root, 'Installing OneKey')
    $progress = [FixtureAccessibility]::Find($root, 'Installing OneKey', 48)
    [FixtureAccessibility]::CheckValue($root, $progress, '43%')
    $null = [FixtureAccessibility]::Find($root, ([string][FixtureAccessibility]::Status($root, $progress)), 41)
    Wait-Log 'prepare=ok'
    $cancel = [FixtureAccessibility]::Find($root, 'Cancel', 43)
    [FixtureAccessibility]::CheckState($root, $cancel, 1, $true)
    [FixtureAccessibility]::CheckRejectedInvocation($root, $cancel, -2147024891)
    Wait-Log 'finish-page=ok'
    Press-Key $window 0x0D
    Wait-Log 'finish-event=primary'
}

Run-Fixture 'fresh-install' @('/PAGE=welcome', '/MODE=replay') {
    param($window)
    Save-Capture $window 'welcome'
    Press-Key $window 0x09
    Press-Key $window 0x20
    $null = Wait-For { [FixtureWindow]::IsIconic($window) } 'keyboard minimize'
    [FixtureWindow]::Send($window, 0x0112, [IntPtr]0xF120, [IntPtr]::Zero)
    $null = Wait-For { ![FixtureWindow]::IsIconic($window) } 'system restore'
    Click $window 450 408
    Save-Capture $window 'welcome-expanded'
    Click $window 601 398
    Click $window 697 475
    Wait-Log 'event=browse-all'
    Click $window 450 280
    Wait-Log 'event=primary-all'
    Wait-Log 'unaccepted=ok'
    Start-Sleep -Milliseconds 450
    if (@(Get-Content -LiteralPath $log | Where-Object { $_ -ceq 'event=primary-all' }).Count -ne 1) {
        throw 'The initial all-users event replayed after returning to welcome'
    }
    Click $window 450 280
    Wait-Log 'prepare=ok'
    Wait-Log 'finish-page=ok'
    Save-Capture $window 'finish'
    Press-Key $window 0x0D
    Wait-Log 'finish-event=primary'
    Wait-Log 'finish-reshow=ok'
    Press-Key $window 0x0D
    Wait-Log 'finish-retry=primary'
}

Run-Fixture 'cancel-install' @('/PAGE=welcome', '/MODE=commit') {
    param($window, $process)
    Press-Key $window 0x0D
    Wait-Log 'event=primary-current'
    Wait-Log 'worker-progress=ok'
    Press-Key $window 0x1B
    Save-Capture $window 'confirmExit'
    Wait-Log 'prepare=pending'
    Click $window 553 400
    Click $window 358 400
    Press-Key $window 0x1B
    Wait-Log 'prepare=cancel'
    if (!$process.WaitForExit(5000) -or $process.ExitCode -ne 3) {
        throw 'Confirmed cancellation did not stop the fixture worker'
    }
}

Run-Fixture 'continue-install' @('/PAGE=welcome', '/MODE=commit') {
    param($window)
    Press-Key $window 0x0D
    Wait-Log 'worker-progress=ok'
    Save-Capture $window 'installing'
    Press-Key $window 0x1B
    Wait-Log 'prepare=pending'
    Press-Key $window 0x0D
    Wait-Log 'prepare=ok'
    Press-Key $window 0x1B
    Wait-Log 'finish-page=ok'
    Press-Key $window 0x0D
    Wait-Log 'finish-event=primary'
}

Run-Fixture 'cancel-uninstall' @('/PAGE=uninstallWelcome', '/MODE=repeat-uninstall') {
    param($window, $process)
    Press-Key $window 0x0D
    Wait-Log 'worker-progress=ok'
    [FixtureWindow]::Send($window, 0x0010, [IntPtr]::Zero, [IntPtr]::Zero)
    Wait-Log 'uninstalling-repeat=ok'
    Wait-Log 'prepare=cancel'
    if (!$process.WaitForExit(5000) -or $process.ExitCode -ne 3) {
        throw 'The repeated uninstalling page cleared pending cancellation'
    }
}

foreach ($dpi in @(96, 120, 144, 192)) {
    Run-Fixture "dpi-$dpi" @('/PAGE=welcome', "/DPI=$dpi") {
        param($window)
        Wait-Log "dpi=$dpi"
        $work = [FixtureWindow]::WorkArea($window)
        $expectedScale = [Math]::Min($dpi / 96, [Math]::Min(
            ($work.Right - $work.Left) / 900, ($work.Bottom - $work.Top) / 560))
        $bounds = [FixtureWindow+Rect]::new()
        if (![FixtureWindow]::GetClientRect($window, [ref]$bounds) -or
            [Math]::Abs($bounds.Right - 900 * $expectedScale) -gt 1 -or
            [Math]::Abs($bounds.Bottom - 560 * $expectedScale) -gt 1) {
            throw "Client bounds at $dpi DPI differ from the monitor-clamped canvas"
        }
        Save-Capture $window "dpi-$dpi"
        Close-Fixture $window
    }
}

foreach ($page in @('scope', 'upgradeScope', 'upgrade', 'options', 'error',
                    'uninstallWelcome', 'uninstalling', 'uninstallFinish', 'uninstallError')) {
    Run-Fixture $page @("/PAGE=$page") {
        param($window)
        Save-Capture $window $page
        if ($page -eq 'scope' -or $page -eq 'upgradeScope') {
            Click $window 450 275
            Wait-Log 'event=scope-current'
            Click $window 450 370
            Wait-Log 'event=scope-all'
        } elseif ($page -eq 'options') {
            Click $window 692 285
            Wait-Log 'event=browse'
        }
        Close-Fixture $window
    }
}

foreach ($locale in @('bn', 'de', 'en-US', 'es', 'fr-FR', 'hi-IN', 'id', 'it-IT',
                      'ja-JP', 'ko-KR', 'pt', 'pt-BR', 'ru', 'th-TH', 'uk-UA', 'vi',
                      'zh-CN', 'zh-HK', 'zh-TW')) {
    Run-Fixture "locale-$locale" @('/PAGE=welcome', "/LOCALE=$locale") {
        param($window)
        Save-Capture $window "locale-$locale"
        Close-Fixture $window
    }
}
Write-Output "Native NSIS fixture passed with captures in $EvidenceDirectory"
