#!/usr/bin/env node

/**
 * Android Perf Regression Guard (Detox + performance-server)
 *
 * Orchestrates:
 * - cache cleanup (always)
 * - performance-server availability check
 * - Detox run (3 sequential runs in a single jest file) => sessionIds
 * - derive-session for each sessionId
 * - aggregation + threshold check
 * - Slack webhook notification on regression or failure
 */

const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const { execCmd } = require('./lib/exec');
const { ensureDir, readJson, writeJson, fileExists } = require('./lib/fs');
const { postSlackWebhook } = require('./lib/slack');

const { readPerfCiLocalConfig } = require('./lib/config');
const { deriveSession, defaultDerivedOutPath } = require('./lib/derive');
const { nowId } = require('./lib/id');
const {
  ensurePerfServerRunning,
  checkPerfServer,
  stopChild,
} = require('./lib/perfServer');
const {
  ensureSessionsDirWritable,
  readSessionMetrics,
} = require('./lib/session');
const {
  aggregateRuns,
  checkRegression,
  extractDerivedDebugMetrics,
} = require('./lib/regression');

function hasFlag(name) {
  return process.argv.includes(name);
}

function detectAndroidAvdNameSync() {
  // Keep it sync: we need the value before we can spawn Detox/emulator reliably.
  try {
    const { execSync } = require('child_process');
    const raw = execSync('emulator -list-avds', {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString('utf8')
      .trim();
    if (raw) return raw.split('\n')[0].trim() || null;
  } catch {
    // ignore
  }
  return null;
}

function parseAdbDevices(text) {
  const out = [];
  const lines = String(text || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  for (const line of lines) {
    if (!line.startsWith('List of devices')) {
      const [id, state] = line.split(/\s+/);
      if (id && state) out.push({ id, state });
    }
  }
  return out;
}

async function waitForAndroidEmulatorDevice({ timeoutMs = 5 * 60_000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    // eslint-disable-next-line no-await-in-loop
    const r = await execCmd('adb', ['devices']);
    const devs = parseAdbDevices(r.stdout);
    const emu = devs.find((d) => d.id.startsWith('emulator-'));
    if (emu && emu.state === 'device') return emu.id;
    // eslint-disable-next-line no-await-in-loop
    await new Promise((res) => setTimeout(res, 1000));
  }
  throw new Error(
    `Timeout waiting for Android emulator to show up in "adb devices" (timeoutMs=${timeoutMs})`,
  );
}

async function waitForAndroidBootComplete({
  deviceId,
  timeoutMs = 5 * 60_000,
} = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    // eslint-disable-next-line no-await-in-loop
    const r = await execCmd('adb', [
      '-s',
      deviceId,
      'shell',
      'getprop',
      'sys.boot_completed',
    ]);
    if (String(r.stdout || '').trim() === '1') return;
    // eslint-disable-next-line no-await-in-loop
    await new Promise((res) => setTimeout(res, 1000));
  }
  throw new Error(
    `Timeout waiting for Android boot complete (deviceId=${deviceId}, timeoutMs=${timeoutMs})`,
  );
}

async function bestEffortAndroidPostBoot({ deviceId } = {}) {
  if (!deviceId) return;

  // Unlock + turn off animations for stability.
  await execCmd('adb', ['-s', deviceId, 'shell', 'input', 'keyevent', '82']);
  await execCmd('adb', [
    '-s',
    deviceId,
    'shell',
    'settings',
    'put',
    'global',
    'window_animation_scale',
    '0',
  ]);
  await execCmd('adb', [
    '-s',
    deviceId,
    'shell',
    'settings',
    'put',
    'global',
    'transition_animation_scale',
    '0',
  ]);
  await execCmd('adb', [
    '-s',
    deviceId,
    'shell',
    'settings',
    'put',
    'global',
    'animator_duration_scale',
    '0',
  ]);
}

function startAndroidEmulator({ avdName, headless, outputDir }) {
  const logOutPath = path.join(outputDir, 'android-emulator.log');
  const logErrPath = path.join(outputDir, 'android-emulator.error.log');
  ensureDir(outputDir);
  const outFd = fs.openSync(logOutPath, 'a');
  const errFd = fs.openSync(logErrPath, 'a');

  const args = [
    '-avd',
    avdName,
    '-no-snapshot-save',
    '-no-boot-anim',
    '-netdelay',
    'none',
    '-netspeed',
    'full',
    '-noaudio',
  ];
  if (headless) args.push('-no-window');

  const child = spawn('emulator', args, {
    stdio: ['ignore', outFd, errFd],
    detached: true,
  });

  fs.closeSync(outFd);
  fs.closeSync(errFd);
  child.unref();

  return { child, pid: child.pid, logOutPath, logErrPath };
}

async function ensureAndroidEmulatorRunning({
  avdName,
  outputDir,
  headless,
} = {}) {
  // If one is already running, do nothing.
  {
    const r = await execCmd('adb', ['devices']);
    const devs = parseAdbDevices(r.stdout);
    const emu = devs.find((d) => d.id.startsWith('emulator-'));
    if (emu && emu.state === 'device') {
      await bestEffortAndroidPostBoot({ deviceId: emu.id });
      return { started: false, deviceId: emu.id };
    }
  }

  if (!avdName) {
    throw new Error(
      'No Android AVD name found.\n' +
        'Fix options:\n' +
        '- Set DETOX_ANDROID_AVD_NAME=YourAvdName\n' +
        '- Or create an AVD in Android Studio (then re-run this script)',
    );
  }

  await requireCommand(
    'emulator',
    'Android SDK Emulator is required (emulator). Install via Android Studio SDK Manager.',
  );

  const started = startAndroidEmulator({ avdName, headless, outputDir });

  const deviceId = await waitForAndroidEmulatorDevice({
    timeoutMs:
      Number(process.env.PERF_ANDROID_EMULATOR_TIMEOUT_MS) || 6 * 60_000,
  });
  await waitForAndroidBootComplete({
    deviceId,
    timeoutMs: Number(process.env.PERF_ANDROID_BOOT_TIMEOUT_MS) || 6 * 60_000,
  });
  await bestEffortAndroidPostBoot({ deviceId });

  return { started: true, deviceId, ...started };
}

async function clearMetroCaches(repoRoot) {
  // Keep it in shell so we can reuse $TMPDIR semantics.
  const script = [
    'set -e',
    // Watchman may not exist on some machines; do not fail the job for that.
    'command -v watchman >/dev/null 2>&1 && watchman watch-del-all || true',
    // Detox/Metro caches (workspace + root).
    'rm -rf apps/mobile/node_modules/.cache/metro-cache node_modules/.cache/metro-cache /tmp/metro "$TMPDIR"/metro-* "$TMPDIR"/haste-map-* || true',
  ].join('\n');

  const r = await execCmd('bash', ['-lc', script], { cwd: repoRoot });
  return r.code === 0;
}

async function freeMetroPort(port = 8081) {
  const r = await execCmd('bash', [
    '-lc',
    `lsof -nP -iTCP:${port} -sTCP:LISTEN -t || true`,
  ]);
  const pids = String(r.stdout || '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!pids.length) return;

  await execCmd('bash', ['-lc', `kill ${pids.join(' ')} 2>/dev/null || true`]);
  await execCmd('bash', ['-lc', 'sleep 0.5']);
  await execCmd('bash', [
    '-lc',
    `lsof -nP -iTCP:${port} -sTCP:LISTEN -t | xargs -n 1 kill -9 2>/dev/null || true`,
  ]);
}

async function requireCommand(cmd, hint) {
  const r = await execCmd('bash', ['-lc', `command -v ${cmd} >/dev/null 2>&1`]);
  if (r.code !== 0) {
    throw new Error(
      [`Missing required command: ${cmd}`, hint || null]
        .filter(Boolean)
        .join('\n'),
    );
  }
}

function buildSlackText({ status, meta, runs, agg, thresholds, outputDir }) {
  const lines = [];
  const mode = meta?.mode || 'release';
  lines.push(`${status}: Android ${mode} Perf Regression Guard`);
  if (meta?.git?.sha) lines.push(`commit: ${meta.git.sha}`);
  if (meta?.startedAt) lines.push(`time: ${meta.startedAt}`);
  lines.push(`output: ${outputDir}`);
  lines.push('');
  lines.push('runs:');
  for (const r of runs) {
    const m = r.metrics || {};
    lines.push(
      `#${r.runIndex} session=${r.sessionId} start=${
        m.tokensStartMs ?? 'n/a'
      }ms span=${m.tokensSpanMs ?? 'n/a'}ms functionCalls=${
        m.functionCallCount ?? 'n/a'
      }`,
    );
  }
  lines.push('');
  lines.push(
    `median: start=${agg.tokensStartMs ?? 'n/a'}ms span=${
      agg.tokensSpanMs ?? 'n/a'
    }ms functionCalls=${agg.functionCallCount ?? 'n/a'}`,
  );
  lines.push(
    `thresholds: start=${thresholds.tokensStartMs ?? 'n/a'}ms span=${
      thresholds.tokensSpanMs ?? 'n/a'
    }ms functionCalls=${thresholds.functionCallCount ?? 'n/a'} (strategy=${
      thresholds.strategy || 'median'
    })`,
  );
  return lines.join('\n');
}

async function main() {
  const repoRoot = path.join(__dirname, '..', '..');

  const localConfig = readPerfCiLocalConfig(repoRoot) || {};

  const sessionsDir =
    process.env.PERF_SESSIONS_DIR ||
    localConfig.sessionsDir ||
    path.join(os.homedir(), 'perf-sessions');
  const serverUrl =
    process.env.PERF_SERVER_URL ||
    localConfig.perfServerUrl ||
    'http://localhost:9527';
  const slackWebhookUrl =
    process.env.SLACK_WEBHOOK_URL || localConfig.slackWebhookUrl || null;
  const serverAutostart = process.env.PERF_SERVER_AUTOSTART !== '0';
  const serverOneshot = process.env.PERF_SERVER_ONESHOT === '1';

  const detoxConfig = process.env.DETOX_CONFIGURATION || 'android.emu.release';
  const mode = detoxConfig.includes('release') ? 'release' : 'debug';
  const headless = hasFlag('--headless');
  const useMetro =
    process.env.PERF_USE_METRO || (detoxConfig.includes('release') ? '0' : '1');
  const runCount = Number(process.env.PERF_RUN_COUNT) || 3;
  const markName = process.env.PERF_MARK_NAME || 'Home:refresh:done:tokens';

  const afterMarkDelayMs = Number(process.env.AFTER_MARK_DELAY_MS) || 4000;
  const markTimeoutMs = Number(process.env.PERF_MARK_TIMEOUT_MS) || 120_000;
  const sessionTimeoutMs =
    Number(process.env.PERF_SESSION_TIMEOUT_MS) || 5 * 60_000;

  const outputRoot =
    process.env.PERF_JOB_OUTPUT_ROOT ||
    path.join(repoRoot, 'development', 'perf-ci', 'output');
  const jobId = process.env.PERF_JOB_ID || `android-${mode}-${nowId()}`;
  const outputDir = path.join(outputRoot, jobId);
  const detoxOutDir = path.join(outputDir, 'detox');
  const derivedDir = path.join(outputDir, 'derived');

  const thresholdsPath =
    process.env.PERF_THRESHOLDS_PATH ||
    path.join(
      repoRoot,
      'development',
      'perf-ci',
      'thresholds',
      `android.${mode}.json`,
    );

  ensureDir(detoxOutDir);
  ensureDir(derivedDir);

  const startedAt = new Date().toISOString();

  const meta = {
    startedAt,
    sessionsDir,
    serverUrl,
    markName,
    runCount,
    mode,
    git: {},
  };

  // Best-effort git sha for traceability.
  {
    const r = await execCmd('bash', ['-lc', 'git rev-parse HEAD'], {
      cwd: repoRoot,
    });
    if (r.code === 0) meta.git.sha = String(r.stdout).trim();
  }

  const jobState = { meta, status: 'running' };
  writeJson(path.join(outputDir, 'job-meta.json'), jobState);

  let perfServer = null;
  let emulator = null;
  let exitCode = 2;

  try {
    await requireCommand(
      'adb',
      'Android SDK Platform-Tools are required (adb). Install via Android Studio SDK Manager.',
    );

    ensureSessionsDirWritable(sessionsDir);
    await clearMetroCaches(repoRoot);
    if (useMetro !== '0') {
      await freeMetroPort(8081);
    }

    const avdName =
      process.env.DETOX_ANDROID_AVD_NAME ||
      process.env.ANDROID_AVD_NAME ||
      localConfig.androidAvdName ||
      detectAndroidAvdNameSync();
    meta.android = { avdName };
    emulator = await ensureAndroidEmulatorRunning({
      avdName,
      outputDir,
      headless,
    });

    if (serverAutostart) {
      perfServer = await ensurePerfServerRunning({
        repoRoot,
        sessionsDir,
        serverUrl,
        outputDir,
        oneshot: serverOneshot,
      });
    } else {
      await checkPerfServer(serverUrl);
    }

    const buildRes = await execCmd(
      'yarn',
      [
        'workspace',
        '@onekeyhq/mobile',
        'detox',
        'build',
        '--configuration',
        detoxConfig,
      ],
      {
        cwd: repoRoot,
        timeoutMs: Number(process.env.DETOX_BUILD_TIMEOUT_MS) || 60 * 60 * 1000,
        stdout: (d) => process.stdout.write(d),
        stderr: (d) => process.stderr.write(d),
      },
    );
    if (buildRes.code !== 0) {
      throw new Error(`Detox build failed with exit code ${buildRes.code}`);
    }

    const detoxEnv = {
      ...(avdName ? { DETOX_ANDROID_AVD_NAME: avdName } : {}),
      PERF_SESSIONS_DIR: sessionsDir,
      PERF_MARK_NAME: markName,
      PERF_RUN_COUNT: String(runCount),
      PERF_JOB_OUTPUT_DIR: detoxOutDir,
      AFTER_MARK_DELAY_MS: String(afterMarkDelayMs),
      PERF_MARK_TIMEOUT_MS: String(markTimeoutMs),
      PERF_SESSION_TIMEOUT_MS: String(sessionTimeoutMs),
      PERF_METRO_PLATFORM: 'android',
      PERF_METRO_APP_ID: 'so.onekey.app.wallet',
      PERF_USE_METRO: useMetro,
      METRO_URL: process.env.METRO_URL || 'http://localhost:8081',
      PERF_TEST_TIMEOUT_MS: String(
        Number(process.env.PERF_TEST_TIMEOUT_MS) || 30 * 60 * 1000,
      ),
      METRO_BUNDLE_WARMUP_TIMEOUT_MS:
        process.env.METRO_BUNDLE_WARMUP_TIMEOUT_MS || String(5 * 60 * 1000),
    };

    const detoxArgs = [
      'workspace',
      '@onekeyhq/mobile',
      'detox',
      'test',
      '--configuration',
      detoxConfig,
    ];
    if (!hasFlag('--no-reuse')) detoxArgs.push('--reuse');
    if (!hasFlag('--no-cleanup')) detoxArgs.push('--cleanup');
    if (useMetro === '0') detoxArgs.push('--no-start');
    if (hasFlag('--headless')) detoxArgs.push('--headless');

    const detoxRes = await execCmd('yarn', detoxArgs, {
      cwd: repoRoot,
      env: detoxEnv,
      timeoutMs: Number(process.env.DETOX_TIMEOUT_MS) || 30 * 60 * 1000,
      stdout: (d) => process.stdout.write(d),
      stderr: (d) => process.stderr.write(d),
    });

    if (detoxRes.code !== 0) {
      throw new Error(`Detox failed with exit code ${detoxRes.code}`);
    }

    const runsPath = path.join(detoxOutDir, 'runs.json');
    if (!fileExists(runsPath)) {
      throw new Error(`Detox finished but runs.json not found at ${runsPath}`);
    }

    const runsJson = readJson(runsPath);
    const runs = Array.isArray(runsJson?.runs) ? runsJson.runs : [];
    const sessionIds = runs.map((r) => r.sessionId).filter(Boolean);
    if (sessionIds.length !== runCount) {
      throw new Error(
        `Expected ${runCount} sessionIds, got ${
          sessionIds.length
        } (${sessionIds.join(',')})`,
      );
    }

    const derived = [];
    for (const r of runs) {
      const sessionId = r.sessionId;
      // eslint-disable-next-line no-await-in-loop
      const outPath = defaultDerivedOutPath({ derivedDir, sessionId });
      const dj = await deriveSession({
        repoRoot,
        sessionsDir,
        sessionId,
        outPath,
      });
      derived.push({ sessionId, derivedPath: outPath, derived: dj });
    }

    const runResults = runs.map((r) => {
      const dj =
        derived.find((d) => d.sessionId === r.sessionId)?.derived || null;
      return {
        ...r,
        metrics: {
          ...readSessionMetrics({ sessionsDir, sessionId: r.sessionId }),
          ...extractDerivedDebugMetrics(dj),
        },
      };
    });

    const thresholds = readJson(thresholdsPath);
    const { values, agg } = aggregateRuns(runResults);
    const exceed = checkRegression({ thresholds, values, agg });

    const report = {
      meta,
      outputDir,
      thresholdsPath,
      thresholds,
      derivedDir,
      runs: runResults,
      agg,
      regression: exceed,
    };

    writeJson(path.join(outputDir, 'report.json'), report);

    if (exceed.triggered && slackWebhookUrl) {
      const text = buildSlackText({
        status: 'REGRESSION',
        meta,
        runs: runResults,
        agg,
        thresholds,
        outputDir,
      });
      await postSlackWebhook(slackWebhookUrl, { text });
    }

    writeJson(path.join(outputDir, 'job-result.json'), {
      status: exceed.triggered ? 'regression' : 'ok',
      reasons: exceed.reasons,
    });

    jobState.status = exceed.triggered ? 'regression' : 'ok';
    jobState.meta.finishedAt = new Date().toISOString();
    writeJson(path.join(outputDir, 'job-meta.json'), jobState);

    exitCode = exceed.triggered ? 3 : 0;
    return exitCode;
  } catch (err) {
    const message = err?.stack || err?.message || String(err);
    writeJson(path.join(outputDir, 'job-error.json'), { error: message });

    if (slackWebhookUrl) {
      await postSlackWebhook(slackWebhookUrl, {
        text: `FAILED: Android ${mode} Perf Regression Guard\n${message}\noutput: ${outputDir}`,
      }).catch(() => {});
    }

    jobState.status = 'failed';
    jobState.meta.finishedAt = new Date().toISOString();
    writeJson(path.join(outputDir, 'job-meta.json'), jobState);

    exitCode = 2;
    return exitCode;
  } finally {
    if (serverOneshot && perfServer?.started && perfServer?.child) {
      // eslint-disable-next-line no-await-in-loop
      await stopChild(perfServer.child);
    }
    // By default we keep the emulator running (like iOS simulator) for faster subsequent runs.
    // If you want one-shot emulator teardown, set PERF_ANDROID_EMULATOR_ONESHOT=1.
    if (
      process.env.PERF_ANDROID_EMULATOR_ONESHOT === '1' &&
      emulator?.started &&
      emulator?.deviceId
    ) {
      await execCmd('adb', ['-s', emulator.deviceId, 'emu', 'kill']).catch(
        () => {},
      );
    }
  }
}

module.exports = { main };

if (require.main === module) {
  main().then((code) => process.exit(code));
}
