#!/usr/bin/env node

/**
 * Extension Perf Regression Guard (production build + performance-server)
 *
 * Orchestrates:
 * - ensure perf-server availability (optional autostart)
 * - build @onekeyhq/ext (manifest v3) with PERF_MONITOR_ENABLED=1
 * - Playwright launches Chromium with unpacked extension (prepared profile)
 * - collect 3 runs: open extension UI + detect new sessionId + wait for mark
 * - derive-session for each sessionId
 * - aggregation + threshold check
 * - optional Slack webhook notification on regression or failure
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const { chromium } = require('playwright-core');

const { execCmd } = require('./lib/exec');
const { ensureDir, readJson, writeJson, fileExists } = require('./lib/fs');
const { readPerfCiLocalConfig } = require('./lib/config');
const { defaultDerivedOutPath, deriveSession } = require('./lib/derive');
const { nowId } = require('./lib/id');
const { findChromiumExecutable } = require('./lib/chromium');
const { postSlackWebhook } = require('./lib/slack');
const {
  ensurePerfServerRunning,
  checkPerfServer,
  stopChild,
} = require('./lib/perfServer');
const {
  listSessionIds,
  waitForNewSessionId,
  waitForMark,
  readSessionMetrics,
  ensureSessionsDirWritable,
} = require('./lib/session');
const {
  aggregateRuns,
  checkRegression,
  extractDerivedDebugMetrics,
} = require('./lib/regression');

function ensureDirExists(p) {
  fs.mkdirSync(p, { recursive: true });
}

function makeLogger() {
  const prefix = '[perf:ext]';
  return (...args) => {
    // eslint-disable-next-line no-console
    console.log(prefix, ...args);
  };
}

function buildSlackText({ status, meta, runs, agg, thresholds, outputDir }) {
  const lines = [];
  lines.push(`${status}: Ext release Perf Regression Guard`);
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

async function buildExt({ repoRoot }) {
  const skip = process.env.PERF_SKIP_EXT_BUILD === '1';
  if (skip) return;

  const res = await execCmd(
    'yarn',
    ['workspace', '@onekeyhq/ext', 'build:v3'],
    {
      cwd: repoRoot,
      env: {
        PERF_MONITOR_ENABLED: '1',
      },
      timeoutMs:
        Number(process.env.PERF_EXT_BUILD_TIMEOUT_MS) || 30 * 60 * 1000,
      stdout: (d) => process.stdout.write(d),
      stderr: (d) => process.stderr.write(d),
    },
  );
  if (res.code !== 0) {
    throw new Error(`ext build failed with exit code ${res.code}`);
  }
}

async function getExtensionId(context) {
  // MV3: service worker.
  const fromSw = async () => {
    let sw = context.serviceWorkers()[0];
    if (!sw) {
      sw = await context.waitForEvent('serviceworker', { timeout: 30_000 });
    }
    const u = new URL(sw.url());
    return u.host;
  };

  // MV2 fallback: background page.
  const fromBg = async () => {
    const bg = context.backgroundPages()[0];
    if (!bg) return null;
    const u = new URL(bg.url());
    return u.host;
  };

  try {
    return await fromSw();
  } catch {
    return await fromBg();
  }
}

async function runOne({
  runIndex,
  sessionsDir,
  markName,
  sessionTimeoutMs,
  markTimeoutMs,
  afterMarkDelayMs,
  userDataDir,
  executablePath,
  extDir,
  extPagePath,
  log,
}) {
  const before = listSessionIds(sessionsDir);
  const t0 = Date.now();

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false, // Extensions are generally not supported in headless mode reliably.
    executablePath,
    args: [
      `--disable-extensions-except=${extDir}`,
      `--load-extension=${extDir}`,
      '--no-first-run',
      '--no-default-browser-check',
    ],
  });

  try {
    const extId = await getExtensionId(context);
    if (!extId) {
      throw new Error(
        'Failed to detect extension id (no service worker / background page).',
      );
    }
    log(`run ${runIndex}: extensionId=${extId}`);

    const page = await context.newPage();
    const url = `chrome-extension://${extId}/${extPagePath}`;
    log(`run ${runIndex}: open ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    log(`run ${runIndex}: wait new sessionId (timeoutMs=${sessionTimeoutMs})`);
    const sessionId = await waitForNewSessionId({
      sessionsDir,
      beforeSet: before,
      timeoutMs: sessionTimeoutMs,
    });
    log(`run ${runIndex}: got sessionId=${sessionId}`);

    log(
      `run ${runIndex}: wait mark "${markName}" (timeoutMs=${markTimeoutMs})`,
    );
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
  } finally {
    await context.close().catch(() => {});
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

  const afterMarkDelayMs = Number(process.env.AFTER_MARK_DELAY_MS) || 4000;
  const markTimeoutMs = Number(process.env.PERF_MARK_TIMEOUT_MS) || 120_000;
  const sessionTimeoutMs =
    Number(process.env.PERF_SESSION_TIMEOUT_MS) || 5 * 60_000;

  const outputRoot =
    process.env.PERF_JOB_OUTPUT_ROOT ||
    path.join(repoRoot, 'development', 'perf-ci', 'output');
  const jobId = process.env.PERF_JOB_ID || `ext-release-${nowId()}`;
  const outputDir = path.join(outputRoot, jobId);
  const derivedDir = path.join(outputDir, 'derived');

  const thresholdsPath =
    process.env.PERF_THRESHOLDS_PATH ||
    path.join(
      repoRoot,
      'development',
      'perf-ci',
      'thresholds',
      'ext.release.json',
    );

  ensureDir(outputDir);
  ensureDir(derivedDir);

  log(`outputDir=${outputDir}`);
  log(
    `runs=${runCount} mark=${markName} sessionsDir=${sessionsDir} serverUrl=${serverUrl}`,
  );

  const extBuildRoot =
    process.env.PERF_EXT_BUILD_ROOT ||
    path.join(repoRoot, 'apps', 'ext', 'build');
  const extDir =
    process.env.PERF_EXT_BUILD_DIR ||
    localConfig.extBuildDir ||
    (fileExists(path.join(extBuildRoot, 'chrome_v3', 'manifest.json'))
      ? path.join(extBuildRoot, 'chrome_v3')
      : extBuildRoot);
  const extPagePath = process.env.PERF_EXT_PAGE || 'ui-popup.html';

  const profileDir =
    process.env.PERF_EXT_PROFILE_DIR ||
    localConfig.extProfileDir ||
    path.join(os.homedir(), 'perf-profiles', 'ext');
  ensureDirExists(profileDir);

  const preferredBrowser = localConfig.chromeExecutablePath || null;
  const executablePath = findChromiumExecutable(preferredBrowser);
  if (!executablePath) {
    throw new Error(
      [
        'Chromium/Chrome/Edge executable not found.',
        '',
        'Fix options:',
        '- Install Google Chrome / Microsoft Edge on the perf machine',
        '- Or set PERF_CHROME_EXECUTABLE_PATH=/absolute/path/to/Chromium',
        '- Or set chromeExecutablePath in development/perf-ci/config.local.json',
      ].join('\n'),
    );
  }

  const startedAt = new Date().toISOString();
  const meta = {
    startedAt,
    sessionsDir,
    serverUrl,
    markName,
    runCount,
    mode: 'release',
    ext: {
      extDir,
      extPagePath,
      profileDir,
      executablePath,
    },
    git: {},
  };

  {
    const r = await execCmd('bash', ['-lc', 'git rev-parse HEAD'], {
      cwd: repoRoot,
    });
    if (r.code === 0) meta.git.sha = String(r.stdout).trim();
  }

  const jobState = { meta, status: 'running' };
  writeJson(path.join(outputDir, 'job-meta.json'), jobState);

  let perfServer = null;

  try {
    ensureSessionsDirWritable(sessionsDir);

    if (serverAutostart) {
      log('perf-server: ensure running');
      perfServer = await ensurePerfServerRunning({
        repoRoot,
        sessionsDir,
        serverUrl,
        outputDir,
        oneshot: serverOneshot,
      });
    } else {
      log('perf-server: check running');
      await checkPerfServer(serverUrl);
    }

    if (process.env.PERF_SKIP_EXT_BUILD === '1') {
      log('build: skip (PERF_SKIP_EXT_BUILD=1)');
    } else {
      log('build: start (@onekeyhq/ext build:v3)');
    }
    await buildExt({ repoRoot });
    log('build: ok');

    if (!fileExists(path.join(extDir, extPagePath))) {
      throw new Error(
        [
          `Extension build missing ${extPagePath}: ${extDir}`,
          '',
          'Notes:',
          '- EXT_MANIFEST_V3 builds usually output to apps/ext/build/chrome_v3/',
          '',
          'Fix options:',
          '- Set PERF_EXT_BUILD_DIR=/absolute/path/to/apps/ext/build/chrome_v3',
          '- Or set extBuildDir in development/perf-ci/config.local.json',
        ].join('\n'),
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
        userDataDir: profileDir,
        executablePath,
        extDir,
        extPagePath,
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

    return exceed.triggered ? 3 : 0;
  } catch (err) {
    const message = err?.stack || err?.message || String(err);
    writeJson(path.join(outputDir, 'job-error.json'), { error: message });

    if (slackWebhookUrl) {
      await postSlackWebhook(slackWebhookUrl, {
        text: `FAILED: Ext release Perf Regression Guard\n${message}\noutput: ${outputDir}`,
      }).catch(() => {});
    }

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
