import { spawn } from 'child_process';
import os from 'os';
import path from 'path';

import { app } from 'electron';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

// cspell:ignore APPCRASH Hashtable notmatch
const TIMEOUT_MS = 15_000;
const MAX_OUTPUT_BYTES = 2 * 1024 * 1024;
const MAX_EVENTS = 200;
const CACHE_MS = 60_000;

function getPowerShellPath(): string {
  const systemRoot = process.env.SystemRoot;
  if (
    !systemRoot ||
    !path.win32.isAbsolute(systemRoot) ||
    !/^[a-zA-Z]:\\/.test(systemRoot) ||
    systemRoot.includes('..')
  ) {
    throw new OneKeyLocalError('system_root_unavailable');
  }
  return path.win32.join(
    systemRoot,
    'System32',
    'WindowsPowerShell',
    'v1.0',
    'powershell.exe',
  );
}

// The child receives only an executable identity. It never writes event XML or
// Event Viewer messages to stdout; only these selected event fields leave it.
const EVENT_SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = [Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
$request = [Console]::In.ReadToEnd() | ConvertFrom-Json
$exePath = [string]$request.exePath
$exeName = [IO.Path]::GetFileName($exePath)
$events = @()
$sourcesResult = @()
if ($exeName -notmatch '^OneKey(?: Wallet)?\.exe$') {
  @{ events = @(); sources = @(); identityUnavailable = $true } | ConvertTo-Json -Compress -Depth 6
  exit 0
}
# Windows PowerShell 5.1 Get-WinEvent FilterHashtable treats DateTime values as local time.
$start = [datetime]::Parse([string]$request.rangeStartUtc).ToLocalTime()
$end = [datetime]::Parse([string]$request.rangeEndUtc).ToLocalTime()
$sources = @(
  @{ provider = 'Application Error'; id = 1000 },
  @{ provider = 'Windows Error Reporting'; id = 1001 },
  @{ provider = 'Application Hang'; id = 1002 }
)
foreach ($source in $sources) {
  try {
    $items = @(Get-WinEvent -FilterHashtable @{
      LogName = 'Application'
      ProviderName = $source.provider
      Id = $source.id
      StartTime = $start
      EndTime = $end
    } -MaxEvents 500 -ErrorAction Stop)
    $matched = 0
    foreach ($item in $items) {
      $xml = [xml]$item.ToXml()
      $data = @{}
      foreach ($field in $xml.Event.EventData.Data) {
        if ($field.Name) { $data[[string]$field.Name] = [string]$field.'#text' }
      }
      $explicitPath = [string]$data.AppPath
      if (-not $explicitPath -and ([string]$data.ExeFileName -match '^[a-zA-Z]:\\')) {
        $explicitPath = [string]$data.ExeFileName
      }
      if ($explicitPath -and $explicitPath -ine $exePath) { continue }
      $identities = @($data.AppName, $data.ExeFileName, $data.P1)
      $nameMatch = $false
      foreach ($identity in $identities) {
        if ($identity -and ([IO.Path]::GetFileName([string]$identity) -ieq $exeName)) {
          $nameMatch = $true
          break
        }
      }
      if (-not $explicitPath -and -not $nameMatch) { continue }
      $moduleName = [IO.Path]::GetFileName([string]$data.ModuleName)
      $exceptionCode = [string]$data.ExceptionCode
      $eventName = [string]$data.EventName
      if ($source.id -eq 1001 -and $eventName -eq 'APPCRASH') {
        $moduleName = [IO.Path]::GetFileName([string]$data.P4)
        $exceptionCode = [string]$data.P7
      }
      if ($exceptionCode -notmatch '^(?:0x)?[0-9a-fA-F]{8}$') { $exceptionCode = $null }
      $moduleVersion = [string]$data.ModuleVersion
      $appVersion = [string]$data.AppVersion
      $faultOffset = [string]$data.FaultingOffset
      if ($source.id -eq 1001 -and $eventName -eq 'APPCRASH') {
        $moduleVersion = [string]$data.P5
        $appVersion = [string]$data.P2
        $faultOffset = [string]$data.P8
      }
      $processId = [string]$data.ProcessId
      $processStart = [string]$data.AppStartTime
      if (-not $processStart) { $processStart = [string]$data.ProcessCreationTime }
      if (-not $processStart) { $processStart = [string]$data.StartTime }
      $reportId = [string]$data.ReportId
      if (-not $reportId) { $reportId = [string]$data.IntegratorReportId }
      $events += @{
        timeUtc = $item.TimeCreated.ToUniversalTime().ToString('o')
        provider = $source.provider
        eventId = $source.id
        recordId = $item.RecordId
        matchStrength = $(if ($explicitPath) { 'exact_path' } else { 'name_only' })
        appVersion = $appVersion
        faultingModule = $moduleName
        moduleVersion = $moduleVersion
        exceptionCode = $exceptionCode
        faultOffset = $faultOffset
        processId = $processId
        processStart = $processStart
        reportId = $reportId
        eventName = $eventName
      }
      $matched++
      if ($events.Count -ge 200) { break }
    }
    $sourcesResult += @{
      provider = $source.provider
      eventId = $source.id
      status = $(if ($matched -gt 0) { 'ok' } else { 'no_matches' })
      candidates = $items.Count
      matched = $matched
      truncated = ($items.Count -ge 500)
    }
  } catch {
    $errorId = [string]$_.FullyQualifiedErrorId
    $status = 'query_error'
    if ($errorId -match 'NoMatchingEventsFound') { $status = 'no_matches' }
    elseif ($_.Exception -is [UnauthorizedAccessException] -or
            $_.Exception.HResult -eq -2147024891) { $status = 'access_denied' }
    $sourcesResult += @{
      provider = $source.provider
      eventId = $source.id
      status = $status
      candidates = 0
      matched = 0
      truncated = $false
    }
  }
  if ($events.Count -ge 200) { break }
}
@{ events = @($events); sources = @($sourcesResult); identityUnavailable = $false } | ConvertTo-Json -Compress -Depth 6
`;

type ScriptOutput = {
  events?: Array<{
    timeUtc?: unknown;
    provider?: unknown;
    eventId?: unknown;
    faultingModule?: unknown;
    exceptionCode?: unknown;
    recordId?: unknown;
    matchStrength?: unknown;
    appVersion?: unknown;
    moduleVersion?: unknown;
    faultOffset?: unknown;
    processId?: unknown;
    processStart?: unknown;
    reportId?: unknown;
    eventName?: unknown;
  }>;
  sources?: Array<{
    provider?: unknown;
    eventId?: unknown;
    status?: unknown;
    candidates?: unknown;
    matched?: unknown;
    truncated?: unknown;
  }>;
  identityUnavailable?: unknown;
};

function limitedText(
  value: unknown,
  pattern: RegExp,
  maxLength: number,
): string | null {
  return typeof value === 'string' &&
    value.length <= maxLength &&
    pattern.test(value)
    ? value
    : null;
}

function readWindowsEvents(sampledAt: number): Promise<ScriptOutput> {
  return new Promise((resolve, reject) => {
    const input = JSON.stringify({
      exePath: path.win32.normalize(process.execPath),
      rangeStartUtc: new Date(
        sampledAt - 7 * 24 * 60 * 60 * 1000,
      ).toISOString(),
      rangeEndUtc: new Date(sampledAt).toISOString(),
    });
    if (Buffer.byteLength(input, 'utf8') > 4096) {
      reject(new Error('input_limit'));
      return;
    }
    const child = spawn(
      getPowerShellPath(),
      [
        '-NoProfile',
        '-NonInteractive',
        '-EncodedCommand',
        Buffer.from(EVENT_SCRIPT, 'utf16le').toString('base64'),
      ],
      { shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'] },
    );
    let output = '';
    let outputBytes = 0;
    let settled = false;
    const timer = setTimeout(() => {
      child.kill();
      if (settled) return;
      settled = true;
      reject(new Error('timeout'));
    }, TIMEOUT_MS);
    const finish = (error?: Error, result?: ScriptOutput) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error);
      else resolve(result ?? {});
    };
    child.on('error', () => finish(new Error('spawn_failed')));
    child.stdin.on('error', () => finish(new Error('stdin_failed')));
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      outputBytes += Buffer.byteLength(chunk, 'utf8');
      if (outputBytes > MAX_OUTPUT_BYTES) {
        child.kill();
        finish(new Error('output_limit'));
        return;
      }
      output += chunk;
    });
    child.on('close', (code) => {
      if (code !== 0) {
        finish(new Error('collector_failed'));
        return;
      }
      try {
        finish(undefined, JSON.parse(output) as ScriptOutput);
      } catch {
        finish(new Error('invalid_output'));
      }
    });
    child.stdin.end(input);
  });
}

let cachedEvents:
  | { sampledAt: number; promise: Promise<ScriptOutput> }
  | undefined;

function getCachedWindowsEvents(): {
  sampledAt: number;
  promise: Promise<ScriptOutput>;
} {
  if (cachedEvents && Date.now() - cachedEvents.sampledAt < CACHE_MS) {
    return cachedEvents;
  }
  const sampledAt = Date.now();
  cachedEvents = { sampledAt, promise: readWindowsEvents(sampledAt) };
  return cachedEvents;
}

export async function collectWindowsDiagnostics(
  hardening: IWindowsDiagnosticsBundle['system']['hardening'],
): Promise<IWindowsDiagnosticsBundle> {
  const system: IWindowsDiagnosticsBundle['system'] = {
    schemaVersion: 1,
    collectedAtUtc: new Date().toISOString(),
    appVersion: app.getVersion(),
    electronVersion: process.versions.electron ?? '',
    nodeVersion: process.versions.node,
    osRelease: os.release(),
    architecture: process.arch,
    osArchitecture: os.machine(),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    timeZoneOffsetMinutes: new Date().getTimezoneOffset(),
    hardening,
  };
  if (process.platform !== 'win32') {
    return {
      system,
      events: [],
      collection: { status: 'unsupported', errors: [] },
    };
  }
  try {
    const read = getCachedWindowsEvents();
    const raw = await read.promise;
    const allowedProviders = new Map([
      ['Application Error', 1000],
      ['Windows Error Reporting', 1001],
      ['Application Hang', 1002],
    ]);
    const events: IWindowsDiagnosticsBundle['events'] = (
      Array.isArray(raw.events) ? raw.events : []
    )
      .slice(0, MAX_EVENTS)
      .flatMap((event): IWindowsDiagnosticsBundle['events'] => {
        const provider = event.provider;
        const eventId = event.eventId;
        if (
          typeof provider !== 'string' ||
          typeof eventId !== 'number' ||
          allowedProviders.get(provider) !== eventId
        ) {
          return [];
        }
        const timeUtc = limitedText(
          event.timeUtc,
          /^\d{4}-\d\d-\d\dT[\d:.]+Z$/,
          40,
        );
        const eventTime = timeUtc ? Date.parse(timeUtc) : Number.NaN;
        if (
          !timeUtc ||
          !Number.isFinite(eventTime) ||
          eventTime < read.sampledAt - 7 * 24 * 60 * 60 * 1000 ||
          eventTime > read.sampledAt
        )
          return [];
        return [
          {
            timeUtc,
            provider,
            eventId,
            recordId:
              typeof event.recordId === 'number' &&
              Number.isSafeInteger(event.recordId) &&
              event.recordId >= 0
                ? event.recordId
                : null,
            matchStrength:
              event.matchStrength === 'exact_path' ? 'exact_path' : 'name_only',
            appVersion: limitedText(event.appVersion, /^[a-zA-Z0-9._-]+$/, 40),
            faultingModule: limitedText(
              event.faultingModule,
              /^[a-zA-Z0-9._-]+$/,
              128,
            ),
            moduleVersion: limitedText(
              event.moduleVersion,
              /^[a-zA-Z0-9._-]+$/,
              40,
            ),
            exceptionCode: limitedText(
              event.exceptionCode,
              /^(?:0x)?[0-9a-fA-F]{8}$/,
              10,
            ),
            faultOffset: limitedText(
              event.faultOffset,
              /^(?:0x)?[0-9a-fA-F]{1,16}$/,
              18,
            ),
            processId: limitedText(
              event.processId,
              /^(?:0x)?[0-9a-fA-F]{1,8}$/,
              10,
            ),
            processStart: limitedText(
              event.processStart,
              /^(?:0x)?[0-9a-fA-F]{1,18}$/,
              20,
            ),
            reportId: limitedText(
              event.reportId,
              /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
              36,
            ),
            eventName:
              event.eventName === 'APPCRASH' ||
              event.eventName === 'BEX' ||
              event.eventName === 'BEX64'
                ? event.eventName
                : null,
          },
        ];
      });
    const sources = Array.isArray(raw.sources)
      ? raw.sources.flatMap((source) => {
          const eventId = source.eventId;
          const provider = source.provider;
          if (
            typeof provider !== 'string' ||
            typeof eventId !== 'number' ||
            allowedProviders.get(provider) !== eventId
          )
            return [];
          const status = source.status;
          if (
            !['ok', 'no_matches', 'access_denied', 'query_error'].includes(
              String(status),
            )
          ) {
            return [];
          }
          return [
            {
              provider,
              eventId,
              status: status as
                | 'ok'
                | 'no_matches'
                | 'access_denied'
                | 'query_error',
              candidates:
                typeof source.candidates === 'number' &&
                Number.isSafeInteger(source.candidates)
                  ? source.candidates
                  : 0,
              matched:
                typeof source.matched === 'number' &&
                Number.isSafeInteger(source.matched)
                  ? source.matched
                  : 0,
              truncated: source.truncated === true,
            },
          ];
        })
      : [];
    const errors =
      raw.identityUnavailable === true
        ? ['app_identity_unavailable']
        : sources
            .filter(
              (source) =>
                source.status === 'access_denied' ||
                source.status === 'query_error',
            )
            .map((source) => `${source.eventId}:${source.status}`);
    return {
      system,
      events,
      collection: {
        status: errors.length ? 'partial' : 'ok',
        errors,
        sources,
        rangeStartUtc: new Date(
          read.sampledAt - 7 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        rangeEndUtc: new Date(read.sampledAt).toISOString(),
        truncated:
          events.length >= MAX_EVENTS ||
          sources.some((source) => source.truncated),
      },
    };
  } catch (error) {
    const safeError =
      error instanceof Error &&
      [
        'timeout',
        'output_limit',
        'input_limit',
        'spawn_failed',
        'stdin_failed',
        'invalid_output',
        'collector_failed',
        'system_root_unavailable',
      ].includes(error.message)
        ? error.message
        : 'collector_failed';
    return {
      system,
      events: [],
      collection: {
        status: 'unavailable',
        errors: [safeError],
      },
    };
  }
}
