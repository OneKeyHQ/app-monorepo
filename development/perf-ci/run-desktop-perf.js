#!/usr/bin/env node

/**
 * Desktop Perf Regression Guard (production main+renderer + performance-server)
 *
 * Orchestrates:
 * - ensure perf-server availability (optional autostart)
 * - build @onekeyhq/desktop (main + renderer) with PERF_MONITOR_ENABLED=1
 * - launch Electron in PERF_CI_MODE=1 (prepared userDataDir)
 * - collect 3 runs: detect new sessionId + wait for mark
 * - derive-session for each sessionId
 * - aggregation + threshold check
 * - optional Slack webhook notification on regression or failure
 */

const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { withBuildLock } = require('./lib/buildLock');
const { readPerfCiLocalConfig } = require('./lib/config');
const { defaultDerivedOutPath, deriveSession } = require('./lib/derive');
const {
  execCmd,
  formatExecResultError,
  withRepoNodeBin,
} = require('./lib/exec');
const { ensureDir, readJson, writeJson, fileExists } = require('./lib/fs');
const { nowId } = require('./lib/id');
const { notifyPerfFailure, notifyPerfResult } = require('./lib/notify');
const {
  ensurePerfServerRunning,
  checkPerfServer,
  stopChild,
} = require('./lib/perfServer');
const {
  aggregateRuns,
  checkRegression,
  extractDerivedDebugMetrics,
} = require('./lib/regression');
const {
  listSessionIds,
  waitForNewSessionId,
  waitForMark,
  readSessionMetrics,
  ensureSessionsDirWritable,
} = require('./lib/session');

function ensureDirExists(p) {
  fs.mkdirSync(p, { recursive: true });
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function makeLogger() {
  const prefix = '[perf:desktop]';
  return (...args) => {
    // eslint-disable-next-line no-console
    console.log(prefix, ...args);
  };
}

async function buildDesktop({ repoRoot, outputDir }) {
  const mainPath = path.join(
    repoRoot,
    'apps',
    'desktop',
    'app',
    'dist',
    'app.js',
  );
  const rendererIndex = path.join(
    repoRoot,
    'apps',
    'desktop',
    'app',
    'build',
    'index.html',
  );

  const hasOutputs = fileExists(mainPath) && fileExists(rendererIndex);
  const skipRequested = process.env.PERF_SKIP_DESKTOP_BUILD === '1';
  if (skipRequested && hasOutputs) return;
  if (skipRequested && !hasOutputs) {
    // eslint-disable-next-line no-console
    console.log(
      '[perf:desktop] PERF_SKIP_DESKTOP_BUILD=1 set, but build outputs missing; will build anyway.',
    );
  }

  const env = {
    PERF_MONITOR_ENABLED: '1',
  };

  const r1 = await withBuildLock(
    'webpack-build',
    () =>
      execCmd('yarn', ['workspace', '@onekeyhq/desktop', 'build:renderer'], {
        cwd: repoRoot,
        env: withRepoNodeBin(repoRoot, env),
        timeoutMs:
          Number(process.env.PERF_DESKTOP_BUILD_TIMEOUT_MS) || 45 * 60 * 1000,
        killProcessGroup: true,
        stdout: (d) => process.stdout.write(d),
        stderr: (d) => process.stderr.write(d),
      }),
    { log: (...args) => console.log('[perf:desktop]', ...args) },
  );
  if (r1.code !== 0) {
    throw new Error(
      formatExecResultError('desktop build:renderer', r1, { outputDir }),
    );
  }

  const r2 = await execCmd(
    'yarn',
    ['workspace', '@onekeyhq/desktop', 'build:main'],
    {
      cwd: repoRoot,
      env: withRepoNodeBin(repoRoot, env),
      timeoutMs:
        Number(process.env.PERF_DESKTOP_BUILD_TIMEOUT_MS) || 45 * 60 * 1000,
      killProcessGroup: true,
      stdout: (d) => process.stdout.write(d),
      stderr: (d) => process.stderr.write(d),
    },
  );
  if (r2.code !== 0) {
    throw new Error(
      formatExecResultError('desktop build:main', r2, { outputDir }),
    );
  }
}

async function stopProcessTree(child, { timeoutMs = 10_000 } = {}) {
  if (!child) return;
  if (child.exitCode !== null) return;
  child.kill('SIGINT');
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline && child.exitCode === null) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 100));
  }
  if (child.exitCode === null) {
    child.kill('SIGKILL');
  }
}

async function runOne({
  runIndex,
  sessionsDir,
  markName,
  sessionTimeoutMs,
  markTimeoutMs,
  afterMarkDelayMs,
  electronExe,
  mainPath,
  userDataDir,
  extraEnv,
  outputDir,
  verbose,
  log,
}) {
  const before = listSessionIds(sessionsDir);
  const t0 = Date.now();

  const electronLogPath = path.join(outputDir, `electron-run-${runIndex}.log`);
  const electronLogStream = verbose
    ? null
    : fs.createWriteStream(electronLogPath, { flags: 'w' });

  if (verbose) {
    log(`run ${runIndex}: launch Electron (stdio=inherit)`);
  } else {
    log(
      `run ${runIndex}: launch Electron (stdio=quiet, log=${electronLogPath})`,
    );
  }

  const child = spawn(electronExe, [mainPath], {
    stdio: verbose ? 'inherit' : ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      PERF_CI_MODE: '1',
      PERF_DESKTOP_USER_DATA_DIR: userDataDir,
      ...extraEnv,
    },
  });

  if (!verbose && electronLogStream) {
    child.stdout.on('data', (d) => electronLogStream.write(d));
    child.stderr.on('data', (d) => electronLogStream.write(d));
  }

  try {
    const sessionId = await waitForNewSessionId({
      sessionsDir,
      beforeSet: before,
      timeoutMs: sessionTimeoutMs,
    });

    log(`run ${runIndex}: got sessionId=${sessionId}`);

    await waitForMark({
      markLogPath: path.join(sessionsDir, sessionId, 'mark.log'),
      markName,
      timeoutMs: markTimeoutMs,
    });

    log(
      `run ${runIndex}: mark "${markName}" found; wait ${afterMarkDelayMs}ms`,
    );
    await new Promise((r) => setTimeout(r, afterMarkDelayMs));

    return {
      runIndex,
      sessionId,
      markName,
      durations: { totalMs: Date.now() - t0 },
    };
  } catch (e) {
    if (!verbose) {
      log(`run ${runIndex}: failed (see ${electronLogPath})`);
    }
    throw e;
  } finally {
    await stopProcessTree(child, {
      timeoutMs: Number(process.env.PERF_DESKTOP_STOP_TIMEOUT_MS) || 10_000,
    }).catch(() => {});
    if (electronLogStream) {
      await new Promise((r) => electronLogStream.end(r));
    }
  }
}

async function main() {
  const repoRoot = path.join(__dirname, '..', '..');
  const log = makeLogger();

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

  const runCount = Number(process.env.PERF_RUN_COUNT) || 3;
  const markName = process.env.PERF_MARK_NAME || 'Home:refresh:done:tokens';
  const verbose =
    process.env.PERF_DESKTOP_VERBOSE === '1' || hasFlag('--verbose');

  const afterMarkDelayMs = Number(process.env.AFTER_MARK_DELAY_MS) || 4000;
  const markTimeoutMs = Number(process.env.PERF_MARK_TIMEOUT_MS) || 120_000;
  const sessionTimeoutMs =
    Number(process.env.PERF_SESSION_TIMEOUT_MS) || 5 * 60_000;

  const outputRoot =
    process.env.PERF_JOB_OUTPUT_ROOT ||
    path.join(repoRoot, 'development', 'perf-ci', 'output');
  const jobId = process.env.PERF_JOB_ID || `desktop-release-${nowId()}`;
  const outputDir = path.join(outputRoot, jobId);
  const derivedDir = path.join(outputDir, 'derived');

  const thresholdsPath =
    process.env.PERF_THRESHOLDS_PATH ||
    path.join(
      repoRoot,
      'development',
      'perf-ci',
      'thresholds',
      'desktop.release.json',
    );

  ensureDir(outputDir);
  ensureDir(derivedDir);

  log(`outputDir=${outputDir}`);
  log(
    `runs=${runCount} mark=${markName} sessionsDir=${sessionsDir} serverUrl=${serverUrl}`,
  );
  if (!verbose) {
    log(
      'desktop app logs are captured to outputDir/electron-run-*.log (set PERF_DESKTOP_VERBOSE=1 to see them live)',
    );
  }

  const profileDir =
    process.env.PERF_DESKTOP_USER_DATA_DIR ||
    localConfig.desktopProfileDir ||
    path.join(os.homedir(), 'perf-profiles', 'desktop');
  ensureDirExists(profileDir);

  // Don't check existence here: the runner is responsible for building outputs.
  const mainPath =
    process.env.PERF_DESKTOP_MAIN_PATH ||
    path.join(repoRoot, 'apps', 'desktop', 'app', 'dist', 'app.js');
  const rendererIndex =
    process.env.PERF_DESKTOP_INDEX_HTML ||
    path.join(repoRoot, 'apps', 'desktop', 'app', 'build', 'index.html');

  const electronExe = require('electron');

  const startedAt = new Date().toISOString();
  const meta = {
    startedAt,
    jobId,
    sessionsDir,
    serverUrl,
    markName,
    runCount,
    mode: 'release',
    targetKey: 'desktop.release',
    targetLabel: 'Desktop Release',
    desktop: {
      mainPath,
      rendererIndex,
      profileDir,
    },
    git: {},
  };

  {
    const r = await execCmd('bash', ['-lc', 'git rev-parse HEAD'], {
      cwd: repoRoot,
    });
    if (r.code === 0) meta.git.sha = String(r.stdout).trim();
  }
  {
    const rb = await execCmd(
      'bash',
      ['-lc', 'git rev-parse --abbrev-ref HEAD'],
      {
        cwd: repoRoot,
      },
    );
    if (rb.code === 0) meta.git.branch = String(rb.stdout).trim();
  }

  // Read app version: prefer BUILD_APP_VERSION env (set by release CI), fall back to package.json
  if (process.env.BUILD_APP_VERSION) {
    meta.appVersion = process.env.BUILD_APP_VERSION;
  } else {
    try {
      const pkg = JSON.parse(
        fs.readFileSync(
          path.join(repoRoot, 'apps', 'desktop', 'package.json'),
          'utf8',
        ),
      );
      if (pkg.version) meta.appVersion = pkg.version;
    } catch (_) {
      // ignore read errors
    }
  }

  const jobState = { meta, status: 'running' };
  writeJson(path.join(outputDir, 'job-meta.json'), jobState);

  let perfServer = null;

  try {
    ensureSessionsDirWritable(sessionsDir);

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

    await buildDesktop({ repoRoot, outputDir });
    log('build: ok');

    if (!fileExists(mainPath)) {
      const hint = process.env.PERF_DESKTOP_MAIN_PATH
        ? ` (PERF_DESKTOP_MAIN_PATH=${process.env.PERF_DESKTOP_MAIN_PATH})`
        : '';
      throw new Error(`Desktop main not found after build: ${mainPath}${hint}`);
    }

    if (!fileExists(rendererIndex)) {
      const hint = process.env.PERF_DESKTOP_INDEX_HTML
        ? ` (PERF_DESKTOP_INDEX_HTML=${process.env.PERF_DESKTOP_INDEX_HTML})`
        : '';
      throw new Error(
        `Desktop renderer index.html not found after build: ${rendererIndex}${hint}`,
      );
    }

    const runs = [];
    for (let i = 1; i <= runCount; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const r = await runOne({
        runIndex: i,
        sessionsDir,
        markName,
        sessionTimeoutMs,
        markTimeoutMs,
        afterMarkDelayMs,
        electronExe,
        mainPath,
        userDataDir: profileDir,
        extraEnv: {
          PERF_DESKTOP_INDEX_HTML: rendererIndex,
        },
        outputDir,
        verbose,
        log,
      });
      runs.push(r);
      writeJson(path.join(outputDir, 'runs.json'), {
        startedAt,
        sessionsDir,
        runs,
      });
    }

    const sessionIds = runs.map((r) => r.sessionId).filter(Boolean);
    if (sessionIds.length !== runCount) {
      throw new Error(
        `Expected ${runCount} sessionIds, got ${sessionIds.length} (${sessionIds.join(',')})`,
      );
    }

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
    log('derive: ok');

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
    log(
      `result=${exceed.triggered ? 'REGRESSION' : 'OK'} reasons=${exceed.reasons.length}`,
    );

    const report = {
      meta,
      outputDir,
      thresholdsPath,
      thresholds,
      derivedDir,
      runs: runResults,
      values,
      agg,
      regression: exceed,
    };

    writeJson(path.join(outputDir, 'report.json'), report);

    await notifyPerfResult({
      report,
      outputRoot,
      slackWebhookUrl,
      localConfig,
      derivedSessions: derived.map((d) => ({
        sessionId: d.sessionId,
        derived: d.derived,
        jobId,
        sessionsDir,
        platform: meta.targetKey,
      })),
    });

    writeJson(path.join(outputDir, 'job-result.json'), {
      status: exceed.triggered ? 'regression' : 'ok',
      reasons: exceed.reasons,
    });

    jobState.status = exceed.triggered ? 'regression' : 'ok';
    jobState.meta.finishedAt = new Date().toISOString();
    writeJson(path.join(outputDir, 'job-meta.json'), jobState);

    return exceed.triggered ? 3 : 0;
  } catch (err) {
    const message = err?.stack || err?.message || String(err);
    writeJson(path.join(outputDir, 'job-error.json'), { error: message });

    await notifyPerfFailure({
      meta,
      outputDir,
      outputRoot,
      slackWebhookUrl,
      localConfig,
      errorMessage: message,
    }).catch(() => {});

    jobState.status = 'failed';
    jobState.meta.finishedAt = new Date().toISOString();
    writeJson(path.join(outputDir, 'job-meta.json'), jobState);
    return 2;
  } finally {
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
