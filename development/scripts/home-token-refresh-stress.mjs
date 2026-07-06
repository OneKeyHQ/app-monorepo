#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DEFAULT_UDID = '4837E819-A117-4E08-9936-445785D199E3';
const DEFAULT_BUNDLE_ID = 'so.onekey.wallet';

const COORDS = {
  accountButton: [95, 136],
  account1: [195, 196],
  account2: [195, 258],
  addAccount: [190, 310],
  newAccountMore: [361, 315],
  passwordClose: [358, 687],
  removeMenu: [105, 790],
  removeConfirm: [292, 775],

  networkButton: [340, 136],
  allNetworksTab: [160, 98],
  singleNetworkTab: [245, 98],
  allNetworksDone: [196, 812],
  singleRows: {
    solana: [115, 336],
    bitcoin: [115, 476],
    polygon: [115, 523],
  },

  pullToRefreshStart: [200, 360],
  pullToRefreshEnd: [200, 700],
};

function parseArgs(argv) {
  const opts = {
    iterations: 100,
    udid: DEFAULT_UDID,
    bundleId: DEFAULT_BUNDLE_ID,
    session: 'default',
    outDir: `.tmp/home-token-stress-${new Date()
      .toISOString()
      .replace(/[:.]/g, '-')
      .replace('T', '-')
      .slice(0, 19)}`,
    screenshotEvery: 10,
    coldStartEvery: 5,
    accountMutationEvery: 1,
    newAccountColdStart: true,
    purgeColdStartCacheEvery: 0,
    stopOnCrash: true,
    commandTimeoutMs: 90_000,
    waitScale: 1,
  };

  for (const arg of argv) {
    const [key, rawValue] = arg.split('=');
    const value = rawValue ?? '';
    switch (key) {
      case '--iterations':
        opts.iterations = Number(value);
        break;
      case '--udid':
        opts.udid = value;
        break;
      case '--bundle-id':
        opts.bundleId = value;
        break;
      case '--session':
        opts.session = value;
        break;
      case '--out':
        opts.outDir = value;
        break;
      case '--screenshot-every':
        opts.screenshotEvery = Number(value);
        break;
      case '--cold-start-every':
        opts.coldStartEvery = Number(value);
        break;
      case '--account-mutation-every':
        opts.accountMutationEvery = Number(value);
        break;
      case '--purge-cold-start-cache-every':
        opts.purgeColdStartCacheEvery = Number(value);
        break;
      case '--no-new-account-cold-start':
        opts.newAccountColdStart = false;
        break;
      case '--no-stop-on-crash':
        opts.stopOnCrash = false;
        break;
      case '--wait-scale':
        opts.waitScale = Number(value);
        break;
      default:
        if (key === '--help' || key === '-h') {
          printHelpAndExit();
        }
        throw new Error(`Unknown arg: ${arg}`);
    }
  }

  if (!Number.isFinite(opts.iterations) || opts.iterations <= 0) {
    throw new Error('--iterations must be a positive number');
  }
  if (!Number.isFinite(opts.screenshotEvery) || opts.screenshotEvery < 0) {
    throw new Error('--screenshot-every must be a non-negative number');
  }
  return opts;
}

function printHelpAndExit() {
  console.log(`Usage:
  node development/scripts/home-token-refresh-stress.mjs [options]

Options:
  --iterations=100
  --udid=${DEFAULT_UDID}
  --bundle-id=${DEFAULT_BUNDLE_ID}
  --session=default
  --out=.tmp/home-token-stress-...
  --screenshot-every=10          0 disables routine screenshots
  --cold-start-every=5
  --account-mutation-every=1       0 disables add/remove account mutation
  --no-new-account-cold-start      skip cold start on the newly-added empty account
  --purge-cold-start-cache-every=0 0 disables MMKV cold-start-cache purge
  --no-stop-on-crash
  --wait-scale=1

Scenario per loop:
  1. optional cold start with existing cache
  2. All Networks pull-to-refresh
  3. All <-> Solana <-> All <-> Polygon <-> All <-> Bitcoin <-> All
  4. Account #1 <-> Account #2
  5. optional add account, cold start on new no-local-cache account, remove it

Evidence:
  - screenshots under <out>/screenshots
  - run log JSONL under <out>/events.jsonl
  - summary under <out>/summary.md
  - if a crash appears, crash .ips copy + parsed summary + native log tail
`);
  process.exit(0);
}

const opts = parseArgs(process.argv.slice(2));
const rootDir = process.cwd();
const outDir = path.resolve(rootDir, opts.outDir);
const screenshotDir = path.join(outDir, 'screenshots');
const crashDir = path.join(outDir, 'crashes');
fs.mkdirSync(screenshotDir, { recursive: true });
fs.mkdirSync(crashDir, { recursive: true });

const eventLogPath = path.join(outDir, 'events.jsonl');
const summaryPath = path.join(outDir, 'summary.md');
const startMs = Date.now();
const initialCrashFiles = new Set(listCrashReports().map((f) => f.path));
let lastFailure;
let crashDetected;
let isCheckingCrash = false;

function writeEvent(event) {
  fs.appendFileSync(
    eventLogPath,
    `${JSON.stringify({ ts: new Date().toISOString(), ...event })}\n`,
  );
}

function sleep(ms) {
  const scaled = Math.max(0, Math.round(ms * opts.waitScale));
  if (scaled === 0) return;
  spawnSync('sleep', [String(scaled / 1000)], { stdio: 'ignore' });
}

function runCommand(name, args, options = {}) {
  const startedAt = Date.now();
  const result = spawnSync(name, args, {
    cwd: rootDir,
    encoding: 'utf8',
    timeout: options.timeoutMs ?? opts.commandTimeoutMs,
    maxBuffer: 20 * 1024 * 1024,
  });
  const elapsedMs = Date.now() - startedAt;
  const event = {
    phase: 'command',
    cmd: [name, ...args].join(' '),
    status: result.status,
    signal: result.signal,
    elapsedMs,
    stdout: truncate(result.stdout),
    stderr: truncate(result.stderr),
  };
  writeEvent(event);
  if (result.error || result.status !== 0) {
    lastFailure = {
      ...event,
      error: result.error ? String(result.error) : undefined,
    };
    checkCrash(`command-failed:${name}`);
    if (options.allowFailure) {
      return result;
    }
    throw new Error(
      `Command failed (${result.status ?? result.signal}): ${name} ${args.join(
        ' ',
      )}`,
    );
  }
  return result;
}

function truncate(text, max = 4000) {
  if (!text) return '';
  return text.length > max ? `${text.slice(0, max)}...<truncated>` : text;
}

function agent(args, options) {
  return runCommand(
    'agent-device',
    [
      ...args,
      '--platform',
      'ios',
      '--udid',
      opts.udid,
      '--session',
      opts.session,
      '--json',
    ],
    options,
  );
}

function click(x, y, label) {
  writeEvent({ phase: 'tap', label, x, y });
  agent(['click', String(x), String(y)]);
}

function clickSelector(selector, label, fallback) {
  writeEvent({ phase: 'tap-selector', label, selector });
  const result = agent(['click', selector], { allowFailure: true });
  if (result.status !== 0 && fallback) {
    writeEvent({ phase: 'tap-selector-fallback', label, selector, fallback });
    click(fallback[0], fallback[1], `${label}:fallback`);
  }
}

function swipe(x1, y1, x2, y2, durationMs, label) {
  writeEvent({ phase: 'swipe', label, x1, y1, x2, y2, durationMs });
  agent([
    'swipe',
    String(x1),
    String(y1),
    String(x2),
    String(y2),
    String(durationMs),
  ]);
}

function screenshot(name, force = false) {
  if (!force && opts.screenshotEvery <= 0) return;
  const file = path.join(screenshotDir, `${name}.png`);
  agent(['screenshot', file], { timeoutMs: 120_000 });
  writeEvent({ phase: 'screenshot', file });
}

function shouldTakeIterationScreenshot(iteration) {
  return opts.screenshotEvery > 0 && iteration % opts.screenshotEvery === 0;
}

function openApp() {
  agent(['open', opts.bundleId], { timeoutMs: 120_000 });
  sleep(2500);
}

function terminateApp() {
  runCommand('xcrun', ['simctl', 'terminate', opts.udid, opts.bundleId], {
    allowFailure: true,
    timeoutMs: 30_000,
  });
  sleep(1000);
}

function getAppDataDir() {
  const result = runCommand(
    'xcrun',
    ['simctl', 'get_app_container', opts.udid, opts.bundleId, 'data'],
    { timeoutMs: 30_000 },
  );
  return result.stdout.trim();
}

function purgeColdStartCache() {
  terminateApp();
  const appData = getAppDataDir();
  const mmkvDir = path.join(appData, 'Documents', 'mmkv');
  for (const filename of [
    'onekey-cold-start-cache',
    'onekey-cold-start-cache.crc',
  ]) {
    const target = path.join(mmkvDir, filename);
    if (fs.existsSync(target)) {
      fs.rmSync(target, { force: true });
      writeEvent({ phase: 'purge-cold-start-cache', target });
    }
  }
  openApp();
}

function coldStart(label, purge = false, capture = true) {
  writeEvent({ phase: 'cold-start', label, purge });
  if (purge) {
    purgeColdStartCache();
  } else {
    terminateApp();
    openApp();
  }
  if (capture) {
    screenshot(`${label}-cold-start`, true);
  }
  checkCrash(`cold-start:${label}`);
}

function ensureAllNetworks() {
  click(...COORDS.networkButton, 'network:open');
  sleep(900);
  click(...COORDS.allNetworksTab, 'network:all-tab');
  sleep(500);
  click(...COORDS.allNetworksDone, 'network:all-done');
  sleep(2500);
  checkCrash('ensure-all-networks');
}

function selectSingleNetwork(name) {
  const row = COORDS.singleRows[name];
  if (!row) throw new Error(`Unknown single network: ${name}`);
  click(...COORDS.networkButton, `network:${name}:open`);
  sleep(900);
  click(...COORDS.singleNetworkTab, `network:${name}:single-tab`);
  sleep(500);
  click(...row, `network:${name}:row`);
  sleep(2500);
  checkCrash(`select-single:${name}`);
}

function manualRefreshAllNetworks() {
  swipe(
    COORDS.pullToRefreshStart[0],
    COORDS.pullToRefreshStart[1],
    COORDS.pullToRefreshEnd[0],
    COORDS.pullToRefreshEnd[1],
    650,
    'home:pull-to-refresh',
  );
  sleep(5000);
  checkCrash('manual-refresh-all-networks');
}

function selectAccount(accountNumber) {
  click(...COORDS.accountButton, `account:${accountNumber}:open`);
  sleep(900);
  const row = accountNumber === 1 ? COORDS.account1 : COORDS.account2;
  click(...row, `account:${accountNumber}:row`);
  sleep(3000);
  checkCrash(`select-account:${accountNumber}`);
}

function addAndRemoveAccount(iteration) {
  const capture = shouldTakeIterationScreenshot(iteration);
  writeEvent({ phase: 'account-mutation:start', iteration });
  click(...COORDS.accountButton, 'account:add:open-selector');
  sleep(900);
  click(...COORDS.addAccount, 'account:add');
  sleep(3500);
  if (capture) {
    screenshot(`iter-${iteration}-account-added`, true);
  }
  // A password sheet may appear after account creation. Tapping the close
  // coordinate is harmless when it is absent.
  click(...COORDS.passwordClose, 'account:add:password-close');
  sleep(1000);

  if (opts.newAccountColdStart) {
    coldStart(`iter-${iteration}-new-account-no-local-cache`, false, capture);
  }

  click(...COORDS.accountButton, 'account:remove:open-selector');
  sleep(900);
  click(...COORDS.newAccountMore, 'account:remove:more');
  sleep(900);
  clickSelector(
    'id="account-manager-account-remove-button"',
    'account:remove:menu',
    COORDS.removeMenu,
  );
  sleep(900);
  click(...COORDS.removeConfirm, 'account:remove:confirm');
  sleep(2500);
  if (capture) {
    screenshot(`iter-${iteration}-account-removed`, true);
  }
  checkCrash(`account-mutation:${iteration}`);

  // Return to Account #2 as the steady-state account for the rest of the loop.
  click(...COORDS.account2, 'account:return-account-2');
  sleep(2500);
  writeEvent({ phase: 'account-mutation:done', iteration });
}

function runIteration(iteration) {
  writeEvent({ phase: 'iteration:start', iteration });
  console.log(`[home-token-stress] iteration ${iteration}/${opts.iterations}`);
  const capture = shouldTakeIterationScreenshot(iteration);

  if (opts.coldStartEvery > 0 && iteration % opts.coldStartEvery === 0) {
    coldStart(`iter-${iteration}-existing-cache`, false, capture);
  }
  if (
    opts.purgeColdStartCacheEvery > 0 &&
    iteration % opts.purgeColdStartCacheEvery === 0
  ) {
    coldStart(`iter-${iteration}-purged-cold-start-cache`, true, capture);
  }

  ensureAllNetworks();
  manualRefreshAllNetworks();
  if (capture) {
    screenshot(`iter-${iteration}-all-after-refresh`, true);
  }

  for (const network of ['solana', 'polygon', 'bitcoin']) {
    selectSingleNetwork(network);
    if (capture) {
      screenshot(`iter-${iteration}-single-${network}`, true);
    }
    ensureAllNetworks();
    if (capture) {
      screenshot(`iter-${iteration}-back-all-after-${network}`, true);
    }
  }

  selectAccount(1);
  if (capture) {
    screenshot(`iter-${iteration}-account-1`, true);
  }
  selectAccount(2);
  if (capture) {
    screenshot(`iter-${iteration}-account-2`, true);
  }

  if (
    opts.accountMutationEvery > 0 &&
    iteration % opts.accountMutationEvery === 0
  ) {
    addAndRemoveAccount(iteration);
  }

  writeEvent({ phase: 'iteration:done', iteration });
}

function listCrashReports() {
  const dir = path.join(os.homedir(), 'Library', 'Logs', 'DiagnosticReports');
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => /^OneKeyWallet-.*\.ips$/.test(name))
    .map((name) => {
      const file = path.join(dir, name);
      const stat = fs.statSync(file);
      return { path: file, mtimeMs: stat.mtimeMs, size: stat.size };
    })
    .toSorted((a, b) => b.mtimeMs - a.mtimeMs);
}

function parseCrashReport(file) {
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/);
  const header = JSON.parse(lines[0]);
  const body = JSON.parse(lines.slice(1).join('\n'));
  const usedImages = body.usedImages ?? [];
  const faultingThread = body.threads?.[body.faultingThread];
  const frames = (faultingThread?.frames ?? []).slice(0, 40).map((frame) => {
    const image = usedImages[frame.imageIndex] ?? {};
    return `${image.name ?? '?'} ${frame.symbol ?? ''}`.trim();
  });
  const vmLines = String(body.vmSummary ?? '')
    .split('\n')
    .filter((line) =>
      [
        'JS JIT generated code',
        'JS VM Gigacage',
        'MALLOC',
        'VM_ALLOCATE',
        'WebKit Malloc',
        'TOTAL',
      ].some((needle) => line.includes(needle)),
    );
  return {
    file,
    header,
    captureTime: body.captureTime,
    procLaunch: body.procLaunch,
    procRole: body.procRole,
    exception: body.exception,
    termination: body.termination,
    faultingThread: body.faultingThread,
    threadName: faultingThread?.name,
    frames,
    vmLines,
  };
}

function copyNativeLogTail(label) {
  try {
    const appData = getAppDataDir();
    const log = path.join(
      appData,
      'Library',
      'Caches',
      'logs',
      'app-latest.log',
    );
    if (!fs.existsSync(log)) return undefined;
    const out = path.join(crashDir, `${label}-app-latest-tail.log`);
    const result = runCommand('tail', ['-2000', log], {
      allowFailure: true,
      timeoutMs: 30_000,
    });
    fs.writeFileSync(out, result.stdout);
    return out;
  } catch {
    writeEvent({
      phase: 'native-log-tail-failed',
    });
    return undefined;
  }
}

function checkCrash(label) {
  if (crashDetected || isCheckingCrash) return crashDetected;
  const newCrashes = listCrashReports().filter(
    (f) => f.mtimeMs >= startMs - 1000 && !initialCrashFiles.has(f.path),
  );
  if (!newCrashes.length) return undefined;
  isCheckingCrash = true;
  try {
    const latest = newCrashes[0];
    const parsed = parseCrashReport(latest.path);
    const safeLabel = label.replace(/[^a-z0-9_-]+/gi, '_');
    const copyPath = path.join(crashDir, path.basename(latest.path));
    fs.copyFileSync(latest.path, copyPath);
    const parsedPath = path.join(
      crashDir,
      `${path.basename(latest.path)}.json`,
    );
    fs.writeFileSync(parsedPath, JSON.stringify(parsed, null, 2));
    const crashScreenshot = path.join(crashDir, `${safeLabel}-screen.png`);
    agent(['screenshot', crashScreenshot], {
      allowFailure: true,
      timeoutMs: 120_000,
    });
    const nativeTail = copyNativeLogTail(safeLabel);
    crashDetected = {
      label,
      latest,
      copyPath,
      parsedPath,
      parsed,
      nativeTail,
      crashScreenshot: fs.existsSync(crashScreenshot)
        ? crashScreenshot
        : undefined,
    };
    writeEvent({ phase: 'crash-detected', label, crashDetected });
    if (opts.stopOnCrash) {
      throw new Error(`Crash detected after ${label}: ${latest.path}`);
    }
    return crashDetected;
  } finally {
    isCheckingCrash = false;
  }
}

function writeSummary(status) {
  const lines = [
    '# Home Token Refresh Stress Report',
    '',
    `- Status: ${status}`,
    `- Started: ${new Date(startMs).toISOString()}`,
    `- Ended: ${new Date().toISOString()}`,
    `- Iterations requested: ${opts.iterations}`,
    `- UDID: ${opts.udid}`,
    `- Bundle: ${opts.bundleId}`,
    `- Output: ${outDir}`,
    `- Events: ${eventLogPath}`,
    '',
    '## Runtime Notes',
    '',
    '- iOS release native process contains main and background JS runtimes.',
    '- Native MMKV/native-logger are shared process resources.',
    '- JS heap objects are per-runtime copies; this stress test is meant to expose heap pressure across main/bg runtime traffic.',
    '',
    '## Scenario',
    '',
    '- All Networks pull-to-refresh.',
    '- All Networks <-> Solana/Polygon/Bitcoin round trips.',
    '- Account #1 <-> Account #2 switches.',
    '- Add account, optional cold start on the newly-added no-local-token-cache account, then remove account.',
    '- Optional cold start with existing cache and optional purge of cold-start MMKV.',
    `- Routine screenshots are sampled every ${opts.screenshotEvery} iteration(s); crash evidence is always captured.`,
    '',
  ];

  if (crashDetected) {
    lines.push('## Crash');
    lines.push('');
    lines.push(`- Detected after: ${crashDetected.label}`);
    lines.push(`- Crash report: ${crashDetected.copyPath}`);
    lines.push(`- Parsed report: ${crashDetected.parsedPath}`);
    if (crashDetected.nativeTail) {
      lines.push(`- Native log tail: ${crashDetected.nativeTail}`);
    }
    if (crashDetected.crashScreenshot) {
      lines.push(`- Screen at detection: ${crashDetected.crashScreenshot}`);
    }
    lines.push(
      `- Exception: ${JSON.stringify(crashDetected.parsed.exception)}`,
    );
    lines.push(
      `- Faulting thread: ${crashDetected.parsed.faultingThread} ${crashDetected.parsed.threadName ?? ''}`,
    );
    lines.push('');
    lines.push('Top frames:');
    lines.push('');
    for (const frame of crashDetected.parsed.frames.slice(0, 12)) {
      lines.push(`- ${frame}`);
    }
    lines.push('');
  }

  if (lastFailure) {
    lines.push('## Last Failure');
    lines.push('');
    lines.push('```json');
    lines.push(JSON.stringify(lastFailure, null, 2));
    lines.push('```');
    lines.push('');
  }

  fs.writeFileSync(summaryPath, `${lines.join('\n')}\n`);
}

writeEvent({ phase: 'run:start', opts });

try {
  coldStart('start-existing-cache', false);
  for (let iteration = 1; iteration <= opts.iterations; iteration += 1) {
    runIteration(iteration);
  }
  checkCrash('run-complete');
  writeSummary('passed-no-crash-detected');
  writeEvent({ phase: 'run:done', status: 'passed-no-crash-detected' });
  console.log(`[home-token-stress] done: ${summaryPath}`);
} catch {
  writeEvent({ phase: 'run:error' });
  writeSummary(
    crashDetected ? 'failed-crash-detected' : 'failed-command-error',
  );
  console.error('[home-token-stress] failed');
  console.error(`[home-token-stress] summary: ${summaryPath}`);
  process.exit(1);
}
