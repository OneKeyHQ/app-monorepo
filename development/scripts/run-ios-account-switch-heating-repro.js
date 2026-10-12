#!/usr/bin/env node

const { execFile, execFileSync, spawn } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const repoRoot = path.resolve(__dirname, '../..');
const mobileRoot = path.join(repoRoot, 'apps', 'mobile');
const bundleId = process.env.HEATING_REPRO_BUNDLE_ID || 'so.onekey.wallet';

function parseArgs(argv) {
  const result = {
    allowInitialWalletFallback: false,
    includeInactiveStep: false,
    requireInitialFunded: false,
    requireTargetFunded: true,
    skipRecording: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--udid') {
      index += 1;
      result.udid = argv[index];
    } else if (arg === '--app-path') {
      index += 1;
      result.appPath = argv[index];
    } else if (arg === '--build-manifest') {
      index += 1;
      result.buildManifest = argv[index];
    } else if (arg === '--output-dir') {
      index += 1;
      result.outputDir = argv[index];
    } else if (arg === '--initial-wallet-id') {
      index += 1;
      result.initialWalletId = argv[index];
    } else if (arg === '--target-wallet-id') {
      index += 1;
      result.targetWalletId = argv[index];
    } else if (arg === '--allow-initial-wallet-fallback') {
      result.allowInitialWalletFallback = true;
    } else if (arg === '--require-initial-funded') {
      result.requireInitialFunded = true;
    } else if (arg === '--require-target-funded') {
      result.requireTargetFunded = true;
    } else if (arg === '--allow-unfunded-target') {
      result.requireTargetFunded = false;
    } else if (arg === '--include-inactive-step')
      result.includeInactiveStep = true;
    else if (arg === '--skip-recording') result.skipRecording = true;
    else if (arg === '--help' || arg === '-h') result.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return result;
}

function printHelp() {
  console.log(`Usage:
  node development/scripts/run-ios-account-switch-heating-repro.js --udid <simulator-udid> [options]

Options:
  --app-path <path>            Install this exact .app before running
  --output-dir <path>          Artifact directory
  --build-manifest <path>      Build sidecar with buildCommitSha and mainBundleSha256
  --initial-wallet-id <id>     Initial wallet; defaults to the first hw-* wallet
  --target-wallet-id <id>      Indexed-account wallet; defaults to hd-1
  --allow-initial-wallet-fallback
                              Use another wallet if no hw-* wallet exists
  --require-initial-funded    Fail unless the initial wallet shows a non-zero balance
  --require-target-funded     Require a non-zero target balance (default)
  --allow-unfunded-target     Permit an unfunded target wallet
  --include-inactive-step      Include the optional 72s Home/resume step
  --skip-recording             Do not record simulator video
  -h, --help                   Show this help

The simulator must already contain the imported QA wallet data and the current app build.
If EarlGrey cannot inspect a UIKit tab, HEATING_REPRO_NATIVE_UI_SESSION may name an
existing agent-device session bound to the same simulator for current-frame verification.`);
}

function nowId() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  }).trim();
}

function runAsync(command, args) {
  return new Promise((resolve) => {
    execFile(command, args, { encoding: 'utf8' }, (error, stdout) => {
      resolve({ error, stdout: String(stdout || '').trim() });
    });
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveSimulatorUdid(requestedUdid) {
  if (requestedUdid) return requestedUdid;
  if (process.env.HEATING_REPRO_UDID) return process.env.HEATING_REPRO_UDID;

  const devices = JSON.parse(
    run('xcrun', ['simctl', 'list', 'devices', 'booted', '-j']),
  );
  const booted = Object.values(devices.devices || {})
    .flat()
    .filter((device) => device.state === 'Booted');
  const preferred = booted.filter((device) =>
    device.name.includes('SWR-GC-Repro'),
  );
  const candidates = preferred.length === 1 ? preferred : booted;
  if (candidates.length !== 1) {
    throw new Error(
      `Multiple booted simulators found. Pass --udid explicitly: ${booted
        .map((device) => `${device.name} (${device.udid})`)
        .join(', ')}`,
    );
  }
  return candidates[0].udid;
}

function createDetoxConfig({ appPath, configPath, jestConfigPath, udid }) {
  const detoxConfig = `module.exports = ${JSON.stringify(
    {
      testRunner: {
        args: {
          $0: path.join(repoRoot, 'node_modules', 'jest', 'bin', 'jest.js'),
          config: jestConfigPath,
        },
        jest: { setupTimeout: 300_000 },
      },
      apps: { current: { type: 'ios.app', binaryPath: appPath } },
      devices: {
        currentSimulator: {
          type: 'ios.simulator',
          device: { id: udid },
        },
      },
      configurations: {
        current: { device: 'currentSimulator', app: 'current' },
      },
      artifacts: {
        rootDir: path.join(path.dirname(configPath), 'detox-artifacts'),
      },
    },
    null,
    2,
  )};\n`;
  fs.writeFileSync(configPath, detoxConfig, 'utf8');

  const testPath = path.join(
    mobileRoot,
    'e2e',
    'account-switch-heating-repro.test.js',
  );
  const jestConfig = `module.exports = ${JSON.stringify(
    {
      rootDir: mobileRoot,
      testMatch: [testPath],
      testTimeout: 12 * 60 * 1000,
      maxWorkers: 1,
      globalSetup: path.join(mobileRoot, 'e2e', 'globalSetup.js'),
      globalTeardown: path.join(
        repoRoot,
        'node_modules',
        'detox',
        'runners',
        'jest',
        'globalTeardown.js',
      ),
      reporters: [
        path.join(
          repoRoot,
          'node_modules',
          'detox',
          'runners',
          'jest',
          'reporter.js',
        ),
      ],
      testEnvironment: path.join(
        repoRoot,
        'node_modules',
        'detox',
        'runners',
        'jest',
        'testEnvironment',
        'index.js',
      ),
      verbose: true,
    },
    null,
    2,
  )};\n`;
  fs.writeFileSync(jestConfigPath, jestConfig, 'utf8');
}

function getAppPid(udid) {
  const output = run('xcrun', ['simctl', 'spawn', udid, 'launchctl', 'list']);
  const line = output
    .split('\n')
    .find((value) => value.includes(`UIKitApplication:${bundleId}`));
  const pid = Number(line?.split(/\s+/u)[0]);
  return Number.isFinite(pid) && pid > 0 ? pid : null;
}

async function sampleProcess(udid) {
  let pid;
  try {
    pid = getAppPid(udid);
  } catch {
    return null;
  }
  if (!pid) return null;
  const result = await runAsync('ps', [
    '-p',
    String(pid),
    '-o',
    '%cpu=',
    '-o',
    'rss=',
  ]);
  if (result.error || !result.stdout) return null;
  const [cpuRaw, rssRaw] = result.stdout.trim().split(/\s+/u);
  const cpu = Number(cpuRaw);
  const rssKB = Number(rssRaw);
  if (!Number.isFinite(cpu) || !Number.isFinite(rssKB)) return null;
  return { pid, cpu, rssMB: Number((rssKB / 1024).toFixed(1)) };
}

function startProcessSampler({ outputDir, formalStartedAt, udid }) {
  const samplesPath = path.join(outputDir, 'process-samples.jsonl');
  fs.writeFileSync(samplesPath, '', 'utf8');
  const origin = new Date(formalStartedAt).getTime();
  let sampling = false;
  const timer = setInterval(async () => {
    if (sampling) return;
    sampling = true;
    try {
      const sample = await sampleProcess(udid);
      if (sample) {
        fs.appendFileSync(
          samplesPath,
          `${JSON.stringify({
            elapsedSec: Number(((Date.now() - origin) / 1000).toFixed(3)),
            at: new Date().toISOString(),
            ...sample,
          })}\n`,
          'utf8',
        );
      }
    } finally {
      sampling = false;
    }
  }, 1000);
  return () => clearInterval(timer);
}

function startScreenRecording({ outputDir, udid }) {
  const videoPath = path.join(outputDir, 'screen-recording.mp4');
  const temporaryVideoPath = path.join(
    os.tmpdir(),
    `onekey-account-switch-${process.pid}-${Date.now()}.mp4`,
  );
  const child = spawn(
    'xcrun',
    [
      'simctl',
      'io',
      udid,
      'recordVideo',
      '--codec=h264',
      '--force',
      temporaryVideoPath,
    ],
    { stdio: ['ignore', 'ignore', 'pipe'] },
  );
  child.stderr.on('data', (data) => {
    const line = String(data).trim();
    if (line) console.log(`[recordVideo] ${line}`);
  });
  return {
    videoPath,
    stop: async () => {
      if (child.exitCode !== null) return;
      child.kill('SIGINT');
      await new Promise((resolve) => {
        child.once('exit', resolve);
        setTimeout(resolve, 5000);
      });
      if (fs.existsSync(temporaryVideoPath)) {
        fs.copyFileSync(temporaryVideoPath, videoPath);
        fs.unlinkSync(temporaryVideoPath);
      }
    },
  };
}

function preserveNativeLogBeforeLaunch({ logPath, outputDir }) {
  if (!fs.existsSync(logPath)) return;
  // The app must be stopped. Preserve the old file before starting a fresh log
  // so a full QA run does not cross the native logger's broken 20 MiB rollover.
  fs.copyFileSync(
    logPath,
    path.join(outputDir, 'native-log-before-run.log'),
    fs.constants.COPYFILE_EXCL,
  );
  fs.unlinkSync(logPath);
}

function startNativeLogCapture({ logPath, outputDir }) {
  const outputPath = path.join(outputDir, 'native-log-segment.log');
  const manifestPath = path.join(outputDir, 'native-log-capture.json');
  const directory = path.dirname(logPath);
  const identity = (stat) => `${stat.dev}:${stat.ino}`;
  const inventory = () =>
    fs
      .readdirSync(directory)
      .filter((name) => /^app.*\.log$/.test(name))
      .flatMap((name) => {
        try {
          const filePath = path.join(directory, name);
          const stat = fs.statSync(filePath);
          return stat.isFile() ? [{ filePath, stat }] : [];
        } catch (error) {
          if (error.code === 'ENOENT') return [];
          throw error;
        }
      })
      .sort((a, b) => a.stat.birthtimeMs - b.stat.birthtimeMs);
  const ignored = new Set(inventory().map(({ stat }) => identity(stat)));
  const initialFd = fs.openSync(logPath, 'r');
  const initialStat = fs.fstatSync(initialFd);
  const sources = new Map([
    [
      identity(initialStat),
      {
        fd: initialFd,
        name: path.basename(logPath),
        startByte: initialStat.size,
      },
    ],
  ]);
  const errors = [];
  const startedAt = new Date().toISOString();
  const discover = () => {
    try {
      for (const { filePath, stat } of inventory()) {
        const key = identity(stat);
        if (sources.has(key)) {
          sources.get(key).name = path.basename(filePath);
        } else if (!ignored.has(key)) {
          // Keep descriptors open across native logger renames and cleanup.
          const fd = fs.openSync(filePath, 'r');
          const openedKey = identity(fs.fstatSync(fd));
          if (sources.has(openedKey) || ignored.has(openedKey)) {
            fs.closeSync(fd);
          } else {
            sources.set(openedKey, {
              fd,
              name: path.basename(filePath),
              startByte: 0,
            });
          }
        }
      }
    } catch (error) {
      errors.push(error.code || error.message);
    }
  };
  const timer = setInterval(discover, 1000);
  let stopped = false;
  let result = null;
  return {
    outputPath,
    manifestPath,
    stop: async () => {
      if (stopped) return result;
      stopped = true;
      clearInterval(timer);
      discover();
      const activeFilePresent = fs.existsSync(logPath);
      if (!activeFilePresent) errors.push('native-active-log-missing');
      const endedAt = new Date().toISOString();
      const outputFd = fs.openSync(outputPath, 'w');
      const buffer = Buffer.alloc(1024 * 1024);
      const ranges = [];
      try {
        for (const [key, source] of sources) {
          const endByte = fs.fstatSync(source.fd).size;
          if (endByte < source.startByte) errors.push('source-truncated');
          let position = source.startByte;
          while (position < endByte) {
            const count = fs.readSync(
              source.fd,
              buffer,
              0,
              Math.min(buffer.length, endByte - position),
              position,
            );
            if (count === 0) {
              errors.push('source-ended-before-snapshot');
              break;
            }
            fs.writeSync(outputFd, buffer, 0, count);
            position += count;
          }
          ranges.push({
            identity: key,
            name: source.name,
            startByte: source.startByte,
            endByte,
            copiedBytes: position - source.startByte,
          });
        }
      } finally {
        fs.closeSync(outputFd);
        for (const { fd } of sources.values()) fs.closeSync(fd);
      }
      result = {
        startedAt,
        endedAt,
        complete: errors.length === 0,
        activeFilePresent,
        errors,
        sources: ranges,
      };
      writeJson(manifestPath, result);
      return result;
    },
  };
}

function readJsonLines(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return fs
    .readFileSync(filePath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function summarizeSamples(
  samples,
  { formalStartedAt, formalEndedAt, observation } = {},
) {
  const formalEndSec =
    (Date.parse(formalEndedAt) - Date.parse(formalStartedAt)) / 1000;
  const summarizeWindow = (startSec, endSec) => {
    const window = samples.filter(
      (sample) => sample.elapsedSec > startSec && sample.elapsedSec <= endSec,
    );
    const cpuValues = window.map((sample) => sample.cpu);
    const rssValues = window.map((sample) => sample.rssMB);
    return {
      startSec,
      endSec,
      samples: window.length,
      cpuAvg: cpuValues.length
        ? Number(
            (
              cpuValues.reduce((sum, value) => sum + value, 0) /
              cpuValues.length
            ).toFixed(1),
          )
        : null,
      cpuMax: cpuValues.length ? Math.max(...cpuValues) : null,
      rssFirstMB: rssValues.at(0) ?? null,
      rssLastMB: rssValues.at(-1) ?? null,
      rssMaxMB: rssValues.length ? Math.max(...rssValues) : null,
      rssDeltaMB:
        rssValues.length >= 2
          ? Number((rssValues.at(-1) - rssValues[0]).toFixed(1))
          : null,
    };
  };
  const observationStartSec =
    (Date.parse(observation?.startedAt) - Date.parse(formalStartedAt)) / 1000;
  const observationEndSec =
    (Date.parse(observation?.endedAt) - Date.parse(formalStartedAt)) / 1000;
  return {
    memoryMetric:
      'host ps resident set size (RSS), MiB; not native physical footprint',
    cpuMetric: 'host ps process %cpu; may exceed 100% across cores',
    checkpoints: [30, 60, 90, 120, 150, 180].map((endSec) =>
      summarizeWindow(endSec - 30, endSec),
    ),
    formal: summarizeWindow(0, formalEndSec),
    last30: summarizeWindow(Math.max(0, formalEndSec - 30), formalEndSec),
    cooldown:
      Number.isFinite(observationStartSec) && Number.isFinite(observationEndSec)
        ? {
            note: observation.note,
            immediate:
              observation.kind === 'post-QA Home idle' &&
              Math.abs(observationStartSec - formalEndSec) < 1,
            complete: observationEndSec - observationStartSec >= 60,
            whole: summarizeWindow(observationStartSec, observationEndSec),
            after10: summarizeWindow(
              observationStartSec + 10,
              observationEndSec,
            ),
            first10: summarizeWindow(
              observationStartSec,
              observationStartSec + 10,
            ),
            last10: summarizeWindow(observationEndSec - 10, observationEndSec),
            after60: summarizeWindow(
              observationStartSec + 60,
              observationEndSec,
            ),
          }
        : null,
  };
}

function redactNetworkRequest(line) {
  const match = line.match(/(?:fetch|axios):([a-z]+):([^,"\s]+)/iu);
  if (!match) return 'UNKNOWN [unparsed endpoint]';
  try {
    const relative = !/^https?:\/\//iu.test(match[2]);
    const url = new URL(match[2], 'https://relative.invalid');
    const segments = url.pathname.split('/').map((segment, index, all) => {
      let decoded;
      try {
        decoded = decodeURIComponent(segment);
      } catch {
        return '[id]';
      }
      if (
        decoded.length > 32 ||
        /^(?:0x)?[0-9a-f]{16,}$/iu.test(decoded) ||
        /^(?:hd|hw|imported|watching)-/iu.test(decoded) ||
        /^\d+$/u.test(decoded) ||
        /[?=&@]|--/u.test(decoded) ||
        (!/^v\d+$/u.test(decoded) &&
          /^(?:addresses?|accounts?|wallets?|accountId|walletId|account-id|wallet-id)$/iu.test(
            all[index - 1] || '',
          )) ||
        !/^[a-zA-Z0-9_.-]*$/u.test(decoded)
      )
        return '[id]';
      return decoded;
    });
    return `${match[1].toUpperCase()} ${relative ? '[relative]' : url.host}${segments.join('/')}`;
  } catch {
    return `${match[1].toUpperCase()} [unparsed endpoint]`;
  }
}

function parseNativeLog(text, { formalStartedAt, localUtcOffsetMinutes } = {}) {
  const anchorMs = Date.parse(formalStartedAt);
  const offsetMinutes =
    localUtcOffsetMinutes ?? -new Date(anchorMs).getTimezoneOffset();
  const anchorLocal = new Date(anchorMs + offsetMinutes * 60_000);
  let day = Date.UTC(
    anchorLocal.getUTCFullYear(),
    anchorLocal.getUTCMonth(),
    anchorLocal.getUTCDate(),
  );
  let previousClockSec = null;
  let atMs = null;
  const events = [];
  const runtimeHealth = [];
  for (const line of text.split('\n')) {
    const timestamp = line.match(/^(\d{2}):(\d{2}):(\d{2})/u);
    if (timestamp) {
      const clockSec =
        Number(timestamp[1]) * 3600 +
        Number(timestamp[2]) * 60 +
        Number(timestamp[3]);
      if (previousClockSec !== null && previousClockSec - clockSec > 12 * 3600)
        day += 24 * 3_600_000;
      // Native logger prefixes only the first line of a multiline RPC entry.
      atMs = Number.isFinite(day)
        ? day + clockSec * 1000 - offsetMinutes * 60_000
        : null;
      previousClockSec = clockSec;
    }
    for (const match of line.matchAll(
      /\[BgTransport\] dispatchRemoteRequest: .*?method=([^\s,]+)/gu,
    )) {
      events.push({ type: 'rpc', key: match[1], atMs });
    }
    if (line.includes('app => network => start')) {
      events.push({ type: 'network', key: redactNetworkRequest(line), atMs });
    }
    if (line.includes('runtimeHealthCensus')) {
      const payload = line.match(
        /runtimeHealthCensus\s*:\s*(\[.*\])\s*$/u,
      )?.[1];
      if (payload) {
        try {
          for (const report of JSON.parse(payload)) {
            runtimeHealth.push({
              ...report,
              loggedAt: atMs === null ? null : new Date(atMs).toISOString(),
              nativeMemoryMetric:
                report.nativeMemoryMetric ||
                'legacy rssMB is physical footprint with resident-size fallback; not host ps RSS',
            });
          }
        } catch {
          // Ignore a partial final census line while retaining request counts.
        }
      }
    }
  }
  return { events, runtimeHealth };
}

function summarizeEvents(events, startMs, endMs) {
  const window = events.filter(
    (event) =>
      event.atMs !== null && event.atMs >= startMs && event.atMs <= endMs,
  );
  const rpcCounts = new Map();
  const networkCounts = new Map();
  for (const event of window) {
    const counts = event.type === 'rpc' ? rpcCounts : networkCounts;
    counts.set(event.key, (counts.get(event.key) || 0) + 1);
  }
  const top = (counts, name) =>
    [...counts.entries()]
      .toSorted(
        (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
      )
      .slice(0, 20)
      .map(([key, count]) => ({ [name]: key, count }));
  return {
    startedAt: Number.isFinite(startMs)
      ? new Date(startMs).toISOString()
      : null,
    endedAt: Number.isFinite(endMs) ? new Date(endMs).toISOString() : null,
    bgRpcCount: [...rpcCounts.values()].reduce((sum, count) => sum + count, 0),
    rpcTop: top(rpcCounts, 'method'),
    networkRequestCount: [...networkCounts.values()].reduce(
      (sum, count) => sum + count,
      0,
    ),
    networkTop: top(networkCounts, 'request'),
    unparsedNetworkCount: window.filter(
      (event) =>
        event.type === 'network' && event.key.includes('[unparsed endpoint]'),
    ).length,
    abortFetchAccountTokens:
      rpcCounts.get('serviceToken.abortFetchAccountTokens') || 0,
    fetchAccountTokens: rpcCounts.get('serviceToken.fetchAccountTokens') || 0,
  };
}

const censusWindowThresholds = [
  ['allocationMB', 'allocatedMB', 2000, '<'],
  ['gcTimeMs', 'gcMs', 2000, '<'],
  ['gcCount', 'gcCount', 600, '<'],
  ['jsBlockTotalMs', 'blockTotalMs', 3000, '<'],
  ['jsBlockMaxMs', 'blockMaxMs', 300, '<'],
  ['jsBlockOver500', 'blockOver500', 1, '<='],
  ['jsBlockOver1000', 'blockOver1000', 0, '<='],
  ['jsFpsMin', 'jsFpsMin', 45, '>='],
];

function summarizeObservedCensusWindows(reports, formalStartMs, formalEndMs) {
  const observedCompleteCensusWindows = reports
    .filter(
      (report) =>
        !report.suspendedCount &&
        report.windowMs >= 30_000 &&
        Date.parse(report.windowStart) >= formalStartMs &&
        Date.parse(report.windowEnd) <= formalEndMs,
    )
    .map((report) => ({
      ...report,
      nominalWindowMs: 30_000,
      thresholdChecks: censusWindowThresholds.map(
        ([name, field, limit, comparison]) => {
          const value = report[field];
          const measured = typeof value === 'number' && Number.isFinite(value);
          let passed = measured && value < limit;
          if (comparison === '<=') passed = measured && value <= limit;
          if (comparison === '>=') passed = measured && value >= limit;
          let status = 'UNMEASURED';
          if (measured)
            status = passed ? 'WITHIN_OBSERVED_WINDOW_THRESHOLD' : 'FAIL';
          return {
            name,
            value: measured ? value : null,
            limit,
            comparison,
            status,
          };
        },
      ),
    }));
  const observedCompleteCensusWorst = Object.fromEntries(
    censusWindowThresholds.map(([name, field, limit, comparison]) => {
      const measured = observedCompleteCensusWindows.filter(
        (report) =>
          typeof report[field] === 'number' && Number.isFinite(report[field]),
      );
      const ordered = measured.toSorted((left, right) =>
        comparison === '>='
          ? left[field] - right[field]
          : right[field] - left[field],
      );
      const worst = ordered[0];
      return [
        name,
        worst
          ? {
              value: worst[field],
              limit,
              comparison,
              status: worst.thresholdChecks.find((check) => check.name === name)
                .status,
              windowStart: worst.windowStart,
              windowEnd: worst.windowEnd,
              actualDurationMs: worst.windowMs,
              nominalWindowMs: 30_000,
              boundaryPrecisionMs: worst.boundaryPrecisionMs,
            }
          : { value: null, limit, comparison, status: 'UNMEASURED' },
      ];
    }),
  );
  return {
    observedCompleteCensusWindows,
    observedCompleteCensusWorst,
    observedWindowThresholdFailure: observedCompleteCensusWindows.some(
      (report) =>
        report.thresholdChecks.some(
          (check) => check.name !== 'jsFpsMin' && check.status === 'FAIL',
        ),
    ),
    observedWindowThresholdNote:
      'Complete observed windows inside the formal run use the unchanged resource/block nominal-30s thresholds and report actual duration without normalization. jsFpsMin is legacy diagnostic only and cannot fail new acceptance. Low values cannot establish an exact formal-last30 pass.',
  };
}

function describeCensusWindow(report, formalStartedAt, formalEndedAt) {
  const hasPayloadEnd =
    typeof report.windowEndedAt === 'number' &&
    Number.isFinite(report.windowEndedAt);
  const endMs = hasPayloadEnd
    ? report.windowEndedAt
    : Date.parse(report.loggedAt);
  const hasDuration =
    typeof report.windowMs === 'number' &&
    Number.isFinite(report.windowMs) &&
    report.windowMs >= 0;
  // The collector excludes lifecycle inactivity from windowMs, so subtracting
  // it cannot recover the wall-clock start of a suspended window.
  const canRecoverStart =
    hasDuration && !report.suspendedCount && Number.isFinite(endMs);
  const startMs = canRecoverStart ? endMs - report.windowMs : null;
  const formalEndMs = Date.parse(formalEndedAt);
  const formalStartMs = Math.max(
    Date.parse(formalStartedAt),
    formalEndMs - 30_000,
  );
  const hasFormalWindow =
    Number.isFinite(formalStartMs) && Number.isFinite(formalEndMs);
  const overlapMs =
    startMs !== null && hasFormalWindow
      ? Math.max(
          0,
          Math.min(endMs, formalEndMs) - Math.max(startMs, formalStartMs),
        )
      : null;
  return {
    ...report,
    windowStart: startMs === null ? null : new Date(startMs).toISOString(),
    windowEnd: Number.isFinite(endMs) ? new Date(endMs).toISOString() : null,
    windowEndSource: hasPayloadEnd
      ? 'payload windowEndedAt'
      : 'native logger timestamp',
    boundaryPrecisionMs: hasPayloadEnd ? 1 : 1000,
    windowStartSource: canRecoverStart
      ? 'window end minus reported active duration'
      : 'UNMEASURED: duration excludes lifecycle inactivity or is missing',
    formalLast30OverlapMs: overlapMs,
    formalLast30UncoveredMs:
      overlapMs === null ? null : formalEndMs - formalStartMs - overlapMs,
    matchesFormalLast30:
      hasPayloadEnd &&
      startMs !== null &&
      hasFormalWindow &&
      startMs === formalStartMs &&
      endMs === formalEndMs,
  };
}

function summarizeFpsPhase(reports, startMs, endMs) {
  const boundsAvailable =
    Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs;
  const samples = reports
    .flatMap((report) =>
      report.fpsSamplingAvailable === 1 && Array.isArray(report.fpsSamples)
        ? report.fpsSamples
        : [],
    )
    .filter(
      (sample) =>
        Array.isArray(sample) &&
        sample.length === 5 &&
        sample.every(Number.isFinite) &&
        sample[1] > sample[0] &&
        sample[2] > 0 &&
        Number.isInteger(sample[3]) &&
        sample[3] >= 0 &&
        [0, 1].includes(sample[4]),
    )
    .toSorted((left, right) => left[0] - right[0]);
  const overlapping = boundsAvailable
    ? samples.filter((sample) => sample[0] < endMs && sample[1] > startMs)
    : [];
  const contained = overlapping.filter(
    (sample) => sample[0] >= startMs && sample[1] <= endMs,
  );
  let previousEnd = null;
  let overlapCount = 0;
  let clockMismatchCount = 0;
  const valid = [];
  for (const sample of contained) {
    if (previousEnd !== null && sample[0] < previousEnd) overlapCount += 1;
    previousEnd = Math.max(previousEnd ?? sample[1], sample[1]);
    if (Math.abs(sample[1] - sample[0] - sample[2]) > 50) {
      clockMismatchCount += 1;
    } else if (sample[4] === 0) valid.push(sample);
  }
  const durationMs = boundsAvailable ? endMs - startMs : null;
  const validDurationMs = valid.reduce((sum, sample) => sum + sample[2], 0);
  const coveragePct = durationMs ? (validDurationMs / durationMs) * 100 : null;
  const fpsOf = (sample) => (sample[3] * 1000) / sample[2];
  const weightedShare = (predicate) =>
    validDurationMs
      ? (valid
          .filter((sample) => predicate(fpsOf(sample)))
          .reduce((sum, sample) => sum + sample[2], 0) /
          validDurationMs) *
        100
      : null;
  let timeWeightedP10 = null;
  let weight = 0;
  for (const sample of valid.toSorted(
    (left, right) => fpsOf(left) - fpsOf(right),
  )) {
    weight += sample[2];
    if (weight >= validDurationMs * 0.1) {
      timeWeightedP10 = fpsOf(sample);
      break;
    }
  }
  let lowEnd = null;
  let lowDurationMs = 0;
  let lowWindows = 0;
  let maxConsecutiveLowDurationMs = 0;
  let maxConsecutiveLowWindows = 0;
  for (const sample of valid) {
    if (fpsOf(sample) >= 30 || lowEnd === null || sample[0] - lowEnd > 2) {
      lowDurationMs = 0;
      lowWindows = 0;
    }
    if (fpsOf(sample) < 30) {
      lowDurationMs += sample[2];
      if (sample[2] >= 1000) lowWindows += 1;
      maxConsecutiveLowDurationMs = Math.max(
        maxConsecutiveLowDurationMs,
        lowDurationMs,
      );
      maxConsecutiveLowWindows = Math.max(maxConsecutiveLowWindows, lowWindows);
      lowEnd = sample[1];
    } else lowEnd = null;
  }
  const coverageComplete =
    coveragePct !== null &&
    coveragePct >= 95 &&
    coveragePct <= 100.1 &&
    overlapCount === 0 &&
    clockMismatchCount === 0;
  const atLeast45TimePct = weightedShare((fps) => fps >= 45);
  const below30TimePct = weightedShare((fps) => fps < 30);
  const check = (name, value, limit, comparison, passed) => {
    let status = 'UNMEASURED';
    if (coverageComplete) status = passed ? 'PASS' : 'FAIL';
    return { name, value, limit, comparison, status };
  };
  const checks = [
    {
      name: 'validCoveragePct',
      value: coveragePct,
      limit: 95,
      comparison: '>=',
      status: coverageComplete ? 'PASS' : 'UNMEASURED',
    },
    check(
      'atLeast45TimePct',
      atLeast45TimePct,
      90,
      '>=',
      atLeast45TimePct >= 90,
    ),
    check('below30TimePct', below30TimePct, 5, '<=', below30TimePct <= 5),
    check(
      'maxConsecutiveLowWindows',
      maxConsecutiveLowWindows,
      1,
      '<=',
      maxConsecutiveLowWindows <= 1,
    ),
    check(
      'maxConsecutiveLowDurationMs',
      maxConsecutiveLowDurationMs,
      2000,
      '<',
      maxConsecutiveLowDurationMs < 2000,
    ),
  ];
  let status = 'UNMEASURED';
  if (coverageComplete)
    status = checks.some((item) => item.status === 'FAIL') ? 'FAIL' : 'PASS';
  return {
    startedAt: boundsAvailable ? new Date(startMs).toISOString() : null,
    endedAt: boundsAvailable ? new Date(endMs).toISOString() : null,
    durationMs,
    sampleCount: contained.length,
    validSampleCount: valid.length,
    shortSampleCount: valid.filter((sample) => sample[2] < 1000).length,
    boundarySampleCount: overlapping.length - contained.length,
    invalidLifecycleSampleCount: contained.filter((sample) => sample[4] === 1)
      .length,
    invalidLifecycleDurationMs: contained
      .filter((sample) => sample[4] === 1)
      .reduce((sum, sample) => sum + sample[2], 0),
    boundaryOverlapDurationMs: overlapping
      .filter((sample) => sample[0] < startMs || sample[1] > endMs)
      .reduce(
        (sum, sample) =>
          sum + Math.min(sample[1], endMs) - Math.max(sample[0], startMs),
        0,
      ),
    overlapCount,
    clockMismatchCount,
    validDurationMs,
    uncoveredDurationMs:
      durationMs === null ? null : Math.max(0, durationMs - validDurationMs),
    coveragePct,
    atLeast45TimePct,
    below30TimePct,
    timeWeightedP10,
    min: valid.length ? Math.min(...valid.map(fpsOf)) : null,
    maxConsecutiveLowDurationMs,
    maxConsecutiveLowWindows,
    checks,
    status,
  };
}

function summarizeFps(reports, context) {
  const startMs = Date.parse(context.formalStartedAt);
  const endMs = Date.parse(context.formalEndedAt);
  const actions = context.actionTimeline || [];
  const actionStart = (label) =>
    Date.parse(actions.find((action) => action.label === label)?.startedAt);
  const allNetworks = actions.filter((action) =>
    action.label.startsWith('All Networks switch '),
  );
  const rapidBsc = actions.find(
    (action) =>
      action.label.startsWith('BSC switch ') && action.plannedSec === 95,
  );
  const endOf = (action) => (action ? startMs + action.endedSec * 1000 : NaN);
  const phase = (from, to) => summarizeFpsPhase(reports, from, to);
  return {
    schemaVersion: 1,
    methodology:
      'Main-runtime rAF tuples [wallStartMs, wallEndMs, monotonicDurationMs, frames, validityCode]. FPS uses actual monotonic duration. Only complete foreground windows contained in a phase are used; boundary windows are not prorated. Short census-closing windows retain their actual time weight. P10 is the first FPS at cumulative duration >=10%. Acceptance uses >=90% of valid time at >=45 FPS, <=5% below30, and >=95% phase coverage. Two adjacent full nominal1s low windows or a low segment >=2s fail sustained-low acceptance; gaps >2ms break adjacency. A single minimum is diagnostic. Long JS Block is independently assessed.',
    phases: {
      formal: phase(startMs, endMs),
      coldStart: phase(startMs, actionStart('open Trade / Swap')),
      firstNavigation: phase(
        actionStart('open Trade / Swap'),
        actionStart('open Wallet / Home'),
      ),
      continuousSwitching: phase(
        Date.parse(rapidBsc?.startedAt),
        endOf(allNetworks.at(-1)),
      ),
      allNetworks: phase(
        Date.parse(allNetworks[0]?.startedAt),
        endOf(allNetworks.at(-1)),
      ),
      idleRecovery: phase(
        Date.parse(context.observation?.startedAt),
        Date.parse(context.observation?.endedAt),
      ),
    },
  };
}

function summarizeNativeLog(logPath, context = {}) {
  if (!logPath || !fs.existsSync(logPath)) return null;
  const { events, runtimeHealth: parsedRuntimeHealth } = parseNativeLog(
    fs.readFileSync(logPath, 'utf8'),
    context,
  );
  const startMs = Date.parse(context.formalStartedAt);
  const endMs = Date.parse(context.formalEndedAt);
  const runtimeHealth = parsedRuntimeHealth.map((report) =>
    describeCensusWindow(
      report,
      context.formalStartedAt,
      context.formalEndedAt,
    ),
  );
  const actions = context.actionTimeline || [];
  const allNetworkActions = actions.filter((action) =>
    action.label.startsWith('All Networks switch '),
  );
  const firstAllNetwork = allNetworkActions[0];
  const finalAllNetwork = allNetworkActions.at(-1);
  const formal = summarizeEvents(events, startMs, endMs);
  const phases = actions
    .filter((action) => action.label !== 'export state logs')
    .map((action) => ({
      label: action.label.replace(
        /(?:hd|hw|imported|watching)-[\w-]+/gu,
        '[wallet]',
      ),
      plannedSec: action.plannedSec,
      ...summarizeEvents(
        events,
        Date.parse(action.startedAt),
        startMs + action.endedSec * 1000,
      ),
    }));
  const formalHealth = runtimeHealth.filter(
    (report) =>
      Date.parse(report.windowEnd) >= startMs &&
      Date.parse(report.windowEnd) <= endMs,
  );
  return {
    ...formal,
    timing:
      'Native logger has one-second local timestamps; multiline RPC entries inherit the preceding timestamp. Subsecond window boundaries use those timestamps without invented precision.',
    capturedNetworkStartCount: events.filter(
      (event) => event.type === 'network',
    ).length,
    missingTimestampEventCount: events.filter((event) => event.atMs === null)
      .length,
    windows: {
      formal,
      last60: summarizeEvents(events, Math.max(startMs, endMs - 60_000), endMs),
      allNetworks:
        firstAllNetwork && finalAllNetwork
          ? {
              actionCount: allNetworkActions.length,
              ...summarizeEvents(
                events,
                Date.parse(firstAllNetwork.startedAt),
                startMs + finalAllNetwork.endedSec * 1000,
              ),
            }
          : null,
      cooldown: context.observation
        ? summarizeEvents(
            events,
            Date.parse(context.observation.startedAt),
            Date.parse(context.observation.endedAt),
          )
        : null,
    },
    phases,
    fps: summarizeFps(runtimeHealth, context),
    runtimeHealth,
    ...summarizeObservedCensusWindows(runtimeHealth, startMs, endMs),
    formalLast30Census: {
      startedAt:
        Number.isFinite(endMs) && Number.isFinite(startMs)
          ? new Date(Math.max(startMs, endMs - 30_000)).toISOString()
          : null,
      endedAt: Number.isFinite(endMs) ? new Date(endMs).toISOString() : null,
      status: runtimeHealth.some((report) => report.matchesFormalLast30)
        ? 'MEASURED'
        : 'UNMEASURED',
      exactCensus:
        runtimeHealth.find((report) => report.matchesFormalLast30) || null,
      note: 'Only a census with identical boundaries measures the formal last30. Partial overlaps are not prorated: GC, allocation and block events are not uniformly distributed.',
    },
    lastFormalCensus: formalHealth.at(-1) || null,
    lastFormalCensusEndGapMs: formalHealth.length
      ? endMs - Date.parse(formalHealth.at(-1).windowEnd)
      : null,
    runtimeScope:
      'main Hermes heap and cross-runtime receive counters; process CPU/native memory cover both main and bg',
  };
}

function readBuildProvenance({ manifestPath, mainBundleSha256 }) {
  if (!manifestPath)
    return {
      status: 'UNMEASURED',
      buildCommitSha: null,
      reason:
        'No build manifest supplied; checkout HEAD is not evidence of build origin.',
    };
  const manifest = readJson(manifestPath);
  if (
    manifest.mainBundleSha256 !== mainBundleSha256 ||
    !/^[0-9a-f]{40}$/iu.test(manifest.buildCommitSha || '')
  ) {
    return {
      status: 'FAIL',
      buildCommitSha: null,
      reason:
        'Build manifest commit/hash is missing or does not match the installed bundle.',
    };
  }
  return {
    status: 'MEASURED',
    buildCommitSha: manifest.buildCommitSha,
    mainBundleSha256,
    buildDirty: manifest.buildDirty ?? null,
    builtAt: manifest.builtAt ?? null,
    manifestPath,
  };
}

function summarizeAcceptance({
  functionalPassed,
  evidenceCollected,
  maxPositiveDriftMs,
  processSummary,
  nativeLog,
  buildProvenance,
}) {
  const checks = [];
  const add = (name, value, limit, comparison = '<', note) => {
    const measured = typeof value === 'number' && Number.isFinite(value);
    let passed = measured && value < limit;
    if (comparison === '<=') passed = measured && value <= limit;
    if (comparison === '>=') passed = measured && value >= limit;
    let status = 'UNMEASURED';
    if (measured) status = passed ? 'PASS' : 'FAIL';
    checks.push({
      name,
      value: measured ? value : null,
      comparison,
      limit,
      status,
      ...(note ? { note } : {}),
    });
  };
  const census = nativeLog?.formalLast30Census?.exactCensus;
  add('functionalFailures', functionalPassed ? 0 : 1, 0, '<=');
  add('missingEvidence', evidenceCollected ? 0 : 1, 0, '<=');
  add('maxTimelineDriftMs', maxPositiveDriftMs, 10_000);
  add('last30CpuAvg', processSummary.last30.cpuAvg, 100);
  add('last30CpuMax', processSummary.last30.cpuMax, 200);
  add('formalRssDeltaMB', processSummary.formal.rssDeltaMB, 500);
  if (nativeLog?.observedWindowThresholdFailure) {
    checks.push({
      name: 'observedWindowThresholdFailure',
      status: 'FAIL',
      note: nativeLog.observedWindowThresholdNote,
    });
  }
  for (const [name, field, limit, comparison] of censusWindowThresholds.filter(
    ([metricName]) => metricName !== 'jsFpsMin',
  ))
    add(
      name,
      census?.[field],
      limit,
      comparison,
      'Requires a main census with identical formal last30 boundaries. Other observed census windows remain diagnostic evidence in nativeLog.runtimeHealth.',
    );
  add('last60BgRpc', nativeLog?.windows.last60.bgRpcCount, 1200);
  add(
    'last60NetworkRequests',
    nativeLog?.windows.last60.networkRequestCount,
    200,
  );
  add(
    'allNetworksBgRpc',
    nativeLog?.windows.allNetworks?.bgRpcCount,
    600,
    '<=',
  );
  add(
    'allNetworksNetworkRequests',
    nativeLog?.windows.allNetworks?.networkRequestCount,
    120,
    '<=',
  );
  add(
    'allNetworksTokenFetches',
    nativeLog?.windows.allNetworks?.fetchAccountTokens,
    42,
    '<=',
  );
  const idle = processSummary.cooldown?.immediate
    ? processSummary.cooldown
    : null;
  add('immediateIdleCpuAfter10s', idle?.after10.cpuAvg, 30);
  add(
    'immediateIdleRssAfter60s',
    idle?.after60.samples >= 5 ? idle.after60.rssDeltaMB : null,
    0,
    '<=',
    'Observed RSS delta during seconds 60–70 after the last account switch; not a longer-term leak guarantee.',
  );
  for (const [name, note] of [
    [
      'clickVisualFeedbackP95',
      'Requires rendered feedback timing; host Detox dispatch/completion is not visual latency.',
    ],
    [
      'homeInteractiveP95',
      'Semantic Home visibility is recorded separately and does not prove input readiness.',
    ],
    [
      'accountEffectiveLatency',
      'Existing semantic IDs do not expose committed account ownership/data freshness.',
    ],
    [
      'physicalDeviceThermalState',
      'Simulator does not establish physical-device thermal acceptance.',
    ],
    ['threeRunMedianAndWorst', 'Requires aggregation of three complete runs.'],
    [
      'staleOwnerAndFinalAccountCorrectness',
      'Requires owner instrumentation and final asset correctness evidence.',
    ],
    [
      'inactiveProductRequests',
      'Request groups are recorded; business-owner classification is required.',
    ],
  ])
    checks.push({ name, status: 'UNMEASURED', note });
  checks.push({
    name: 'buildProvenance',
    status:
      buildProvenance.status === 'MEASURED' ? 'PASS' : buildProvenance.status,
  });
  const experienceNames = new Set([
    'clickVisualFeedbackP95',
    'homeInteractiveP95',
    'accountEffectiveLatency',
    'staleOwnerAndFinalAccountCorrectness',
  ]);
  const measurementNames = new Set([
    'functionalFailures',
    'missingEvidence',
    'maxTimelineDriftMs',
    'buildProvenance',
    'threeRunMedianAndWorst',
  ]);
  const experienceChecks = checks.filter((check) =>
    experienceNames.has(check.name),
  );
  for (const phase of ['continuousSwitching', 'allNetworks']) {
    const fpsChecks = nativeLog?.fps?.phases[phase]?.checks;
    if (fpsChecks)
      experienceChecks.push(
        ...fpsChecks.map((check) => ({
          ...check,
          name: `${phase}.${check.name}`,
        })),
      );
    else
      experienceChecks.push({
        name: `${phase}.fpsDistribution`,
        status: 'UNMEASURED',
        note: 'Requires raw foreground rAF windows; legacy minima cannot reconstruct the distribution.',
      });
  }
  const worstLongBlock =
    nativeLog?.observedCompleteCensusWorst?.jsBlockOver1000;
  experienceChecks.push({
    name: 'observedJsBlockOver1000',
    value: worstLongBlock?.value ?? null,
    limit: 0,
    comparison: '<=',
    status: worstLongBlock?.value > 0 ? 'FAIL' : 'UNMEASURED',
    note: 'Any observed >1s JS Block fails this condition; partial census coverage cannot establish a whole-phase pass.',
  });
  const group = (items) => {
    let status = 'PASS';
    if (items.some((check) => check.status === 'UNMEASURED'))
      status = 'INCOMPLETE';
    if (items.some((check) => check.status === 'FAIL')) status = 'FAIL';
    return { status, checks: items };
  };
  const experience = group(experienceChecks);
  const resources = group(
    checks.filter(
      (check) =>
        !experienceNames.has(check.name) && !measurementNames.has(check.name),
    ),
  );
  const measurement = group(
    checks.filter((check) => measurementNames.has(check.name)),
  );
  return {
    status: [experience, resources, measurement].some(
      (item) => item.status === 'FAIL',
    )
      ? 'FAIL'
      : 'INCOMPLETE',
    scope:
      'Single simulator run; missing metrics never imply a full performance pass.',
    checks,
    experience,
    resources,
    measurement,
    legacyFpsMinimum: {
      diagnosticOnly: true,
      observedWorst: nativeLog?.observedCompleteCensusWorst?.jsFpsMin ?? null,
    },
  };
}

async function waitForJsonFile(filePath, child) {
  while (child.exitCode === null) {
    if (fs.existsSync(filePath)) return readJson(filePath);
    await sleep(100);
  }
  return null;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const udid = resolveSimulatorUdid(args.udid);
  const sourceAppPath = args.appPath ? path.resolve(args.appPath) : null;
  if (sourceAppPath) {
    if (
      !fs.existsSync(sourceAppPath) ||
      !fs.statSync(sourceAppPath).isDirectory()
    ) {
      throw new Error(`App path is not a directory: ${sourceAppPath}`);
    }
    await runAsync('xcrun', ['simctl', 'terminate', udid, bundleId]);
    run('xcrun', ['simctl', 'install', udid, sourceAppPath]);
  }
  const appPath = run('xcrun', [
    'simctl',
    'get_app_container',
    udid,
    bundleId,
    'app',
  ]);
  const appDataPath = run('xcrun', [
    'simctl',
    'get_app_container',
    udid,
    bundleId,
    'data',
  ]);
  const outputDir = path.resolve(
    args.outputDir ||
      path.join(
        repoRoot,
        'development',
        'output',
        'perf-sessions',
        'account-switch-heating',
        nowId(),
      ),
  );
  fs.mkdirSync(outputDir, { recursive: true });

  if (!sourceAppPath) {
    await runAsync('xcrun', ['simctl', 'terminate', udid, bundleId]);
  }
  if (getAppPid(udid)) {
    throw new Error('App must be stopped before preserving its native log.');
  }
  preserveNativeLogBeforeLaunch({
    logPath: path.join(
      appDataPath,
      'Library',
      'Caches',
      'logs',
      'app-latest.log',
    ),
    outputDir,
  });

  const detoxConfigPath = path.join(outputDir, 'detox.config.js');
  const jestConfigPath = path.join(outputDir, 'jest.config.js');
  const runMetaPath = path.join(outputDir, 'run-meta.json');
  const preparedPath = path.join(outputDir, 'prepared.json');
  const collectorReadyPath = path.join(outputDir, 'collector-ready.json');
  const formalEndPath = path.join(outputDir, 'formal-end.json');
  const observationEndPath = path.join(outputDir, 'observation-end.json');
  for (const transientPath of [
    runMetaPath,
    preparedPath,
    collectorReadyPath,
    formalEndPath,
    observationEndPath,
  ]) {
    if (fs.existsSync(transientPath)) fs.unlinkSync(transientPath);
  }
  createDetoxConfig({
    appPath,
    configPath: detoxConfigPath,
    jestConfigPath,
    udid,
  });

  const git = {
    branch: run('git', ['rev-parse', '--abbrev-ref', 'HEAD']),
    sha: run('git', ['rev-parse', 'HEAD']),
  };
  const mainBundlePath = path.join(appPath, 'main.jsbundle');
  const mainBundleSha256 = fs.existsSync(mainBundlePath)
    ? sha256File(mainBundlePath)
    : null;
  const buildProvenance = readBuildProvenance({
    manifestPath: args.buildManifest ? path.resolve(args.buildManifest) : null,
    mainBundleSha256,
  });
  const localUtcOffsetMinutes = -new Date().getTimezoneOffset();
  writeJson(path.join(outputDir, 'environment.json'), {
    startedAt: new Date().toISOString(),
    udid,
    bundleId,
    appPath,
    sourceAppPath,
    mainBundleSha256,
    buildProvenance,
    localUtcOffsetMinutes,
    appDataPath,
    checkoutGit: git,
    nativeUiSession: process.env.HEATING_REPRO_NATIVE_UI_SESSION || null,
    includeInactiveStep: args.includeInactiveStep,
    initialWalletSelector: args.initialWalletId ? 'explicit' : 'hardware-first',
    allowInitialWalletFallback: args.allowInitialWalletFallback,
    requireInitialFunded: args.requireInitialFunded,
    requireTargetFunded: args.requireTargetFunded,
    host: { platform: process.platform, release: os.release() },
    note: 'Simulator CPU/RSS are comparable regression signals; simulator thermal state is not physical-device evidence.',
  });

  console.log(`Output: ${outputDir}`);
  console.log(`Simulator: ${udid}`);
  console.log(`Git: ${git.branch} ${git.sha}`);

  await runAsync('xcrun', ['simctl', 'terminate', udid, bundleId]);
  await sleep(1000);

  const child = spawn(
    'yarn',
    [
      'detox',
      'test',
      '--configuration',
      'current',
      '--config-path',
      detoxConfigPath,
      '--reuse',
      '--no-start',
      '--loglevel',
      'warn',
    ],
    {
      cwd: mobileRoot,
      env: {
        ...process.env,
        DETOX_CONFIGURATION: 'current',
        PERF_USE_METRO: '0',
        HEATING_REPRO_UDID: udid,
        HEATING_REPRO_OUTPUT_DIR: outputDir,
        HEATING_REPRO_INCLUDE_INACTIVE_STEP: args.includeInactiveStep
          ? '1'
          : '0',
        ...(args.initialWalletId
          ? { HEATING_REPRO_INITIAL_WALLET_ID: args.initialWalletId }
          : {}),
        HEATING_REPRO_ALLOW_INITIAL_WALLET_FALLBACK:
          args.allowInitialWalletFallback ? '1' : '0',
        HEATING_REPRO_REQUIRE_INITIAL_FUNDED: args.requireInitialFunded
          ? '1'
          : '0',
        HEATING_REPRO_REQUIRE_TARGET_FUNDED: args.requireTargetFunded
          ? '1'
          : '0',
        HEATING_REPRO_TARGET_WALLET_ID: args.targetWalletId || 'hd-1',
      },
      stdio: ['ignore', 'inherit', 'inherit'],
    },
  );
  const childExitPromise = new Promise((resolve) =>
    child.once('exit', resolve),
  );

  let stopSampler = () => undefined;
  let recording = null;
  let nativeLogPath = null;
  let nativeLogCapture = null;
  const preparedMeta = await waitForJsonFile(preparedPath, child);
  if (preparedMeta) {
    nativeLogPath = path.join(
      appDataPath,
      'Library',
      'Caches',
      'logs',
      'app-latest.log',
    );
    if (fs.existsSync(nativeLogPath)) {
      nativeLogCapture = startNativeLogCapture({
        logPath: nativeLogPath,
        outputDir,
      });
    }
    if (!args.skipRecording) {
      recording = startScreenRecording({ outputDir, udid });
    }
    writeJson(collectorReadyPath, { readyAt: new Date().toISOString() });
  }

  const formalMeta = await waitForJsonFile(runMetaPath, child);
  if (formalMeta?.formalStartedAt) {
    stopSampler = startProcessSampler({
      outputDir,
      formalStartedAt: formalMeta.formalStartedAt,
      udid,
    });
  }

  const exitCode = await childExitPromise;
  stopSampler();
  const nativeLogCaptureResult = await nativeLogCapture?.stop();
  if (recording) await recording.stop();
  const formalEndMeta = fs.existsSync(formalEndPath)
    ? readJson(formalEndPath)
    : null;
  const observation = fs.existsSync(observationEndPath)
    ? readJson(observationEndPath)
    : null;

  const nativeLogSegmentPath = nativeLogCapture?.outputPath || null;
  const samples = readJsonLines(path.join(outputDir, 'process-samples.jsonl'));
  const actionTimeline = readJsonLines(
    path.join(outputDir, 'action-timeline.jsonl'),
  );
  const finalRunMeta = fs.existsSync(runMetaPath)
    ? readJson(runMetaPath)
    : formalMeta;
  const maxPositiveDriftMs =
    actionTimeline.length > 0
      ? Math.max(...actionTimeline.map((action) => action.driftMs))
      : null;
  const timelineComparable =
    maxPositiveDriftMs !== null && maxPositiveDriftMs < 10_000;
  const functionalPassed = exitCode === 0;
  const nativeLogBytes =
    nativeLogSegmentPath && fs.existsSync(nativeLogSegmentPath)
      ? fs.statSync(nativeLogSegmentPath).size
      : 0;
  const sampleCoverageSec =
    samples.length >= 2 ? samples.at(-1).elapsedSec - samples[0].elapsedSec : 0;
  const processMetricsCollected =
    samples.length >= 120 && sampleCoverageSec >= 150;
  const screenRecordingCollected =
    args.skipRecording ||
    Boolean(
      recording?.videoPath &&
      fs.existsSync(recording.videoPath) &&
      fs.statSync(recording.videoPath).size > 0,
    );
  const logsCollected =
    finalRunMeta?.logCollectionMode === 'native-file' &&
    nativeLogBytes > 0 &&
    nativeLogCaptureResult?.complete === true;
  const evidenceCollected =
    logsCollected && processMetricsCollected && screenRecordingCollected;
  const measurementContext = {
    formalStartedAt: finalRunMeta?.formalStartedAt,
    formalEndedAt: formalEndMeta?.formalEndedAt,
    observation,
    actionTimeline,
    localUtcOffsetMinutes,
  };
  const processSummary = summarizeSamples(samples, measurementContext);
  const nativeLogSummary = summarizeNativeLog(
    nativeLogSegmentPath,
    measurementContext,
  );
  const acceptance = summarizeAcceptance({
    functionalPassed,
    evidenceCollected,
    maxPositiveDriftMs,
    processSummary,
    nativeLog: nativeLogSummary,
    buildProvenance,
  });
  const summary = {
    exitCode,
    functionalPassed,
    logsCollected,
    processMetricsCollected,
    screenRecordingCollected,
    evidenceCollected,
    capturePassed: functionalPassed && evidenceCollected,
    acceptance,
    buildProvenance,
    mainBundleSha256,
    run: finalRunMeta,
    timeline: {
      count: actionTimeline.length,
      failed: actionTimeline.filter((action) => !action.ok),
      formalEnd: formalEndMeta,
      observation,
      maxPositiveDriftMs,
      timelineComparable,
    },
    process: {
      ...processSummary,
      sampleCount: samples.length,
      sampleCoverageSec: Number(sampleCoverageSec.toFixed(1)),
    },
    nativeLog: nativeLogSummary,
    artifacts: {
      actionTimeline: path.join(outputDir, 'action-timeline.jsonl'),
      interactionTimeline: path.join(outputDir, 'interaction-timeline.jsonl'),
      processSamples: path.join(outputDir, 'process-samples.jsonl'),
      nativeLogSegment: nativeLogSegmentPath,
      nativeLogBytes,
      nativeLogCapture: nativeLogCapture?.manifestPath || null,
      screenRecording: recording?.videoPath || null,
      logCollectionMode: 'native-file',
    },
  };
  writeJson(path.join(outputDir, 'summary.json'), summary);
  console.log(`Summary: ${path.join(outputDir, 'summary.json')}`);
  console.log(
    `Capture: ${summary.capturePassed ? 'PASS' : 'FAIL'}; performance acceptance: ${acceptance.status}`,
  );
  if (!summary.capturePassed) process.exitCode = exitCode || 1;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error?.stack || error);
    process.exitCode = 1;
  });
}

module.exports = {
  preserveNativeLogBeforeLaunch,
  startNativeLogCapture,
  parseNativeLog,
  describeCensusWindow,
  summarizeObservedCensusWindows,
  redactNetworkRequest,
  summarizeEvents,
  summarizeNativeLog,
  summarizeFpsPhase,
  summarizeFps,
  summarizeSamples,
  readBuildProvenance,
  summarizeAcceptance,
};
