param(
    [Parameter(Mandatory = $true)]
    [int]$TargetProcessId,
    [string]$OutputFile
)

$ErrorActionPreference = 'Stop'

if (-not ('OneKeyProcessAccessProbe' -as [type])) {
    Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class OneKeyProcessAccessProbe {
    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern IntPtr OpenProcess(uint access, bool inherit, uint processId);
    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool CloseHandle(IntPtr handle);
}
'@
}

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($identity)
$target = Get-CimInstance Win32_Process -Filter "ProcessId=$TargetProcessId"
if (-not $target) {
    throw "Target process $TargetProcessId does not exist."
}
if ($target.CommandLine -match '(?:^|\s)--type=') {
    throw 'The target must be the Electron main process, not a renderer or utility process.'
}

$accessRights = [ordered]@{
    PROCESS_QUERY_LIMITED_INFORMATION = [uint32]0x1000
    SYNCHRONIZE = [uint32]0x100000
    PROCESS_TERMINATE = [uint32]0x0001
    PROCESS_QUERY_INFORMATION = [uint32]0x0400
    PROCESS_VM_READ = [uint32]0x0010
    PROCESS_VM_WRITE = [uint32]0x0020
    PROCESS_VM_OPERATION = [uint32]0x0008
    PROCESS_CREATE_THREAD = [uint32]0x0002
    PROCESS_DUP_HANDLE = [uint32]0x0040
    PROCESS_SET_INFORMATION = [uint32]0x0200
    WRITE_DAC = [uint32]0x00040000
    WRITE_OWNER = [uint32]0x00080000
}

# Only acquire and close handles. Never read, write, suspend, or terminate the target.
$results = foreach ($right in $accessRights.GetEnumerator()) {
    $handle = [OneKeyProcessAccessProbe]::OpenProcess($right.Value, $false, $TargetProcessId)
    $lastError = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
    $opened = $handle -ne [IntPtr]::Zero
    if ($opened) {
        if (-not [OneKeyProcessAccessProbe]::CloseHandle($handle)) {
            throw "CloseHandle failed for $($right.Key)."
        }
    }
    [PSCustomObject]@{
        right = $right.Key
        mask = ('0x{0:X8}' -f $right.Value)
        success = $opened
        win32Error = $(if ($opened) { 0 } else { $lastError })
    }
}

$mitigationOutput = try {
    Get-ProcessMitigation -Id $TargetProcessId -ErrorAction Stop | Out-String
} catch {
    $_ | Out-String
}

$report = [PSCustomObject]@{
    timestamp = [DateTimeOffset]::Now.ToString('o')
    targetProcessId = $TargetProcessId
    targetName = $target.Name
    targetCommandLine = $target.CommandLine
    caller = $identity.Name
    callerElevated = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    rights = @($results)
    getProcessMitigation = $mitigationOutput.Trim()
}
$json = $report | ConvertTo-Json -Depth 5
if ($OutputFile) {
    $json | Set-Content -LiteralPath $OutputFile -Encoding utf8
}
$json
