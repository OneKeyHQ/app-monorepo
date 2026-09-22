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

The simulator must already contain the imported QA wallet data and the current app build.`);
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

function startNativeLogCapture({ logPath, outputDir }) {
  const outputPath = path.join(outputDir, 'native-log-segment.log');
  const outputFd = fs.openSync(outputPath, 'w');
  const child = spawn('tail', ['-c', '0', '-F', logPath], {
    stdio: ['ignore', outputFd, 'ignore'],
  });
  let stopped = false;
  return {
    outputPath,
    stop: async () => {
      if (stopped) return;
      stopped = true;
      if (child.exitCode === null) {
        child.kill('SIGTERM');
        await new Promise((resolve) => {
          child.once('exit', resolve);
          setTimeout(resolve, 3000);
        });
      }
      fs.closeSync(outputFd);
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

function summarizeSamples(samples) {
  const checkpoints = [30, 60, 90, 120, 150, 180].map((endSec) => {
    const startSec = endSec - 30;
    const window = samples.filter(
      (sample) => sample.elapsedSec > startSec && sample.elapsedSec <= endSec,
    );
    const cpuValues = window.map((sample) => sample.cpu);
    const rssValues = window.map((sample) => sample.rssMB);
    return {
      endSec,
      samples: window.length,
      cpuAvg:
        cpuValues.length > 0
          ? Number(
              (
                cpuValues.reduce((sum, value) => sum + value, 0) /
                cpuValues.length
              ).toFixed(1),
            )
          : null,
      cpuMax: cpuValues.length > 0 ? Math.max(...cpuValues) : null,
      rssLastMB: rssValues.length > 0 ? rssValues.at(-1) : null,
      rssMaxMB: rssValues.length > 0 ? Math.max(...rssValues) : null,
    };
  });
  return { checkpoints };
}

function summarizeNativeLog(logPath) {
  if (!logPath || !fs.existsSync(logPath)) return {};
  const text = fs.readFileSync(logPath, 'utf8');
  const rpcCounts = new Map();
  const networkCounts = new Map();
  for (const match of text.matchAll(
    /\[BgTransport\] dispatchRemoteRequest: .*?method=([^\s,]+)/gu,
  )) {
    rpcCounts.set(match[1], (rpcCounts.get(match[1]) || 0) + 1);
  }
  const rpcTop = [...rpcCounts.entries()]
    .toSorted((left, right) => right[1] - left[1])
    .slice(0, 20)
    .map(([method, count]) => ({ method, count }));
  for (const match of text.matchAll(
    /app => network => start\s+:.*?fetch:([A-Z]+):(https?:\/\/[^,\s"]+)/gu,
  )) {
    try {
      const url = new URL(match[2]);
      const redactedPath = url.pathname
        .split('/')
        .map((segment) =>
          segment.length > 32 || /^(?:0x)?[0-9a-f]{24,}$/iu.test(segment)
            ? '[id]'
            : segment,
        )
        .join('/');
      const key = `${match[1]} ${url.host}${redactedPath}`;
      networkCounts.set(key, (networkCounts.get(key) || 0) + 1);
    } catch {
      // Ignore malformed or partial native-log lines.
    }
  }
  const networkTop = [...networkCounts.entries()]
    .toSorted((left, right) => right[1] - left[1])
    .slice(0, 20)
    .map(([request, count]) => ({ request, count }));
  const runtimeHealth = [];
  for (const line of text.split('\n')) {
    if (line.includes('runtimeHealthCensus')) {
      const payload = line.match(
        /runtimeHealthCensus\s*:\s*(\[.*\])\s*$/u,
      )?.[1];
      if (payload) {
        try {
          const reports = JSON.parse(payload);
          for (const report of reports) {
            runtimeHealth.push({
              loggedAt: line.match(/^(\d{2}:\d{2}:\d{2})/u)?.[1] || null,
              ...report,
            });
          }
        } catch {
          // Ignore a partial final line if the native logger was still flushing.
        }
      }
    }
  }
  return {
    bgRpcCount: [...rpcCounts.values()].reduce((sum, count) => sum + count, 0),
    rpcTop,
    networkRequestCount: [...networkCounts.values()].reduce(
      (sum, count) => sum + count,
      0,
    ),
    networkTop,
    abortFetchAccountTokens:
      rpcCounts.get('serviceToken.abortFetchAccountTokens') || 0,
    fetchAccountTokens: rpcCounts.get('serviceToken.fetchAccountTokens') || 0,
    runtimeHealth,
  };
}

async function collectExportedArchives({
  appDataPath,
  formalStartedAt,
  outputDir,
}) {
  const threshold = new Date(formalStartedAt).getTime() - 1000;
  const deadline = Date.now() + 60_000;
  const findArchives = () => {
    const matches = [];
    const visit = (directory) => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const fullPath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
          visit(fullPath);
        } else if (
          /\.(zip|tar|gz)$/iu.test(entry.name) &&
          fs.statSync(fullPath).mtimeMs >= threshold
        ) {
          matches.push(fullPath);
        }
      }
    };
    visit(appDataPath);
    return matches;
  };
  let found = [];
  while (Date.now() < deadline) {
    found = findArchives();
    if (found.length > 0) break;
    await sleep(1000);
  }
  return found.map((sourcePath, index) => {
    const targetPath = path.join(
      outputDir,
      `exported-state-logs-${index + 1}${path.extname(sourcePath)}`,
    );
    fs.copyFileSync(sourcePath, targetPath);
    return targetPath;
  });
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

  const detoxConfigPath = path.join(outputDir, 'detox.config.js');
  const jestConfigPath = path.join(outputDir, 'jest.config.js');
  const runMetaPath = path.join(outputDir, 'run-meta.json');
  const preparedPath = path.join(outputDir, 'prepared.json');
  const collectorReadyPath = path.join(outputDir, 'collector-ready.json');
  const formalEndPath = path.join(outputDir, 'formal-end.json');
  for (const transientPath of [
    runMetaPath,
    preparedPath,
    collectorReadyPath,
    formalEndPath,
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
  writeJson(path.join(outputDir, 'environment.json'), {
    startedAt: new Date().toISOString(),
    udid,
    bundleId,
    appPath,
    sourceAppPath,
    mainBundleSha256: fs.existsSync(mainBundlePath)
      ? sha256File(mainBundlePath)
      : null,
    appDataPath,
    git,
    includeInactiveStep: args.includeInactiveStep,
    initialWalletSelector: args.initialWalletId ? 'explicit' : 'hardware-first',
    allowInitialWalletFallback: args.allowInitialWalletFallback,
    requireInitialFunded: args.requireInitialFunded,
    requireTargetFunded: args.requireTargetFunded,
    targetWalletId: args.targetWalletId || 'hd-1',
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
  let samplerStopped = false;
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

  const formalEndCapturePromise = formalMeta
    ? waitForJsonFile(formalEndPath, child).then(async (meta) => {
        stopSampler();
        samplerStopped = true;
        await nativeLogCapture?.stop();
        return { meta };
      })
    : Promise.resolve(null);

  const exitCode = await childExitPromise;
  const formalEndCapture = await formalEndCapturePromise;
  if (!samplerStopped) stopSampler();
  await nativeLogCapture?.stop();
  if (recording) await recording.stop();

  const nativeLogSegmentPath = nativeLogCapture?.outputPath || null;
  const samples = readJsonLines(path.join(outputDir, 'process-samples.jsonl'));
  const actionTimeline = readJsonLines(
    path.join(outputDir, 'action-timeline.jsonl'),
  );
  const finalRunMeta = fs.existsSync(runMetaPath)
    ? readJson(runMetaPath)
    : formalMeta;
  const exportedArchives = formalMeta
    ? await collectExportedArchives({
        appDataPath,
        formalStartedAt: formalMeta.formalStartedAt,
        outputDir,
      })
    : [];
  const maxPositiveDriftMs =
    actionTimeline.length > 0
      ? Math.max(...actionTimeline.map((action) => action.driftMs))
      : null;
  const timelineComparable =
    maxPositiveDriftMs !== null && maxPositiveDriftMs <= 5000;
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
    finalRunMeta?.exportRequested === true &&
    exportedArchives.length > 0 &&
    nativeLogBytes > 0;
  const evidenceCollected =
    logsCollected && processMetricsCollected && screenRecordingCollected;
  const summary = {
    exitCode,
    functionalPassed,
    logsCollected,
    processMetricsCollected,
    screenRecordingCollected,
    evidenceCollected,
    passed: functionalPassed && evidenceCollected && timelineComparable,
    run: finalRunMeta,
    timeline: {
      count: actionTimeline.length,
      failed: actionTimeline.filter((action) => !action.ok),
      formalEnd: formalEndCapture?.meta || null,
      maxPositiveDriftMs,
      timelineComparable,
    },
    process: {
      ...summarizeSamples(samples),
      sampleCount: samples.length,
      sampleCoverageSec: Number(sampleCoverageSec.toFixed(1)),
    },
    nativeLog: summarizeNativeLog(nativeLogSegmentPath),
    artifacts: {
      actionTimeline: path.join(outputDir, 'action-timeline.jsonl'),
      processSamples: path.join(outputDir, 'process-samples.jsonl'),
      nativeLogSegment: nativeLogSegmentPath,
      nativeLogBytes,
      screenRecording: recording?.videoPath || null,
      exportedArchives,
    },
  };
  writeJson(path.join(outputDir, 'summary.json'), summary);
  console.log(`Summary: ${path.join(outputDir, 'summary.json')}`);
  if (!summary.passed) process.exitCode = exitCode || 1;
}

main().catch((error) => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
