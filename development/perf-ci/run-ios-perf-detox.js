#!/usr/bin/env node

/**
 * iOS Perf Regression Guard (Detox + performance-server)
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
const os = require('os');
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
  // On the perf test machine we want deterministic Metro startup.
  // If something is already listening on the port, kill it first.
  const r = await execCmd('bash', [
    '-lc',
    `lsof -nP -iTCP:${port} -sTCP:LISTEN -t || true`,
  ]);
  const pids = String(r.stdout || '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!pids.length) return;

  // Best-effort graceful stop first, then hard kill.
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

async function ensureIosPodsSynced(repoRoot) {
  const podfileLock = path.join(repoRoot, 'apps/mobile/ios/Podfile.lock');
  const manifestLock = path.join(
    repoRoot,
    'apps/mobile/ios/Pods/Manifest.lock',
  );

  if (!fileExists(podfileLock)) return;

  let needsInstall = !fileExists(manifestLock);
  if (!needsInstall) {
    const r = await execCmd(
      'bash',
      ['-lc', `cmp -s "${manifestLock}" "${podfileLock}"`],
      {
        cwd: repoRoot,
      },
    );
    needsInstall = r.code !== 0;
  }

  if (!needsInstall) return;

  // Keep this automatic: if Podfile.lock changed, the Xcode build will fail with
  // "[CP] Check Pods Manifest.lock" anyway.
  await requireCommand(
    'pod',
    'CocoaPods is required to sync iOS Pods when Podfile.lock changes.',
  );
  const podRes = await execCmd(
    'yarn',
    ['workspace', '@onekeyhq/mobile', 'ios:pod-install'],
    {
      cwd: repoRoot,
      timeoutMs: Number(process.env.POD_INSTALL_TIMEOUT_MS) || 30 * 60 * 1000,
      stdout: (d) => process.stdout.write(d),
      stderr: (d) => process.stderr.write(d),
    },
  );
  if (podRes.code !== 0) {
    throw new Error(`pod install failed with exit code ${podRes.code}`);
  }
}

function buildSlackText({ status, meta, runs, agg, thresholds, outputDir }) {
  const lines = [];
  const mode = meta?.mode || 'debug';
  lines.push(`${status}: iOS ${mode} Perf Regression Guard`);
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

  const detoxConfig = process.env.DETOX_CONFIGURATION || 'ios.sim.debug';
  const mode = detoxConfig.includes('release') ? 'release' : 'debug';
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
  const jobId = process.env.PERF_JOB_ID || `ios-${mode}-${nowId()}`;
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
      `ios.${mode}.json`,
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
  let exitCode = 2;

  try {
    await requireCommand(
      'applesimutils',
      'Install on the test machine:\n  brew tap wix/brew\n  brew install applesimutils',
    );

    ensureSessionsDirWritable(sessionsDir);
    await clearMetroCaches(repoRoot);
    if (useMetro !== '0') {
      await freeMetroPort(8081);
    }

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

    // Ensure iOS Pods are in sync before building the app.
    await ensureIosPodsSynced(repoRoot);

    // Build app binary for Detox to read bundleId from Info.plist.
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

    // Run Detox (the e2e test itself handles the 3-run loop).
    const detoxEnv = {
      PERF_SESSIONS_DIR: sessionsDir,
      PERF_MARK_NAME: markName,
      PERF_RUN_COUNT: String(runCount),
      PERF_JOB_OUTPUT_DIR: detoxOutDir,
      AFTER_MARK_DELAY_MS: String(afterMarkDelayMs),
      PERF_MARK_TIMEOUT_MS: String(markTimeoutMs),
      PERF_SESSION_TIMEOUT_MS: String(sessionTimeoutMs),
      PERF_METRO_PLATFORM: 'ios',
      PERF_METRO_APP_ID: 'so.onekey.wallet',
      PERF_USE_METRO: useMetro,
      METRO_URL: process.env.METRO_URL || 'http://localhost:8081',
      // Avoid jest default 5m timeout under heavy CI load.
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
    // We want to preserve the pre-configured simulator + app data (wallet state), so default to --reuse.
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

    // Derive per session.
    const derived = [];
    for (const r of runs) {
      const sessionId = r.sessionId;
      const outPath = defaultDerivedOutPath({ derivedDir, sessionId });
      // eslint-disable-next-line no-await-in-loop
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
        text: `FAILED: iOS ${mode} Perf Regression Guard\n${message}\noutput: ${outputDir}`,
      }).catch(() => {});
    }

    jobState.status = 'failed';
    jobState.meta.finishedAt = new Date().toISOString();
    writeJson(path.join(outputDir, 'job-meta.json'), jobState);

    exitCode = 2;
    return exitCode;
  } finally {
    // One-shot mode: stop perf-server only if we started it in this job.
    if (serverOneshot && perfServer?.started && perfServer?.child) {
      // eslint-disable-next-line no-await-in-loop
      await stopChild(perfServer.child);
    }
  }
}

module.exports = { main };

if (require.main === module) {
  main().then((code) => process.exit(code));
}
