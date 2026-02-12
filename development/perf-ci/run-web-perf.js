#!/usr/bin/env node

/**
 * Web Perf Regression Guard (production build + performance-server)
 *
 * Orchestrates:
 * - ensure perf-server availability (optional autostart)
 * - build @onekeyhq/web with PERF_MONITOR_ENABLED=1 (optional skip)
 * - serve static build
 * - Playwright drives Chromium to load the app (prepared profile)
 * - collect 3 runs: detect new sessionId + wait for mark
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
const { startStaticServer } = require('./lib/staticServer');
const { postSlackWebhook } = require('./lib/slack');
const {
  ensurePerfServerRunning,
  checkPerfServer,
  stopChild,
} = require('./lib/perfServer');
const {
  ensureSessionsDirWritable,
  listSessionIds,
  waitForNewSessionId,
  waitForMark,
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

function ensureDirExists(p) {
  fs.mkdirSync(p, { recursive: true });
}

function webExtensionsEnabled() {
  // Web perf relies on "wallet-in-browser" behavior; keep extensions enabled by default.
  // Opt-out for debugging only.
  return process.env.PERF_WEB_DISABLE_EXTENSIONS !== '1';
}

function makeLogger() {
  const prefix = '[perf:web]';
  return (...args) => {
    // eslint-disable-next-line no-console
    console.log(prefix, ...args);
  };
}

function buildSlackText({ status, meta, runs, agg, thresholds, outputDir }) {
  const lines = [];
  lines.push(`${status}: Web release Perf Regression Guard`);
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

async function buildWeb({ repoRoot, outputDir }) {
  const skip = process.env.PERF_SKIP_BUILD === '1';
  if (skip) return;

  const res = await execCmd('yarn', ['workspace', '@onekeyhq/web', 'build'], {
    cwd: repoRoot,
    env: {
      PERF_MONITOR_ENABLED: '1',
    },
    timeoutMs: Number(process.env.PERF_WEB_BUILD_TIMEOUT_MS) || 30 * 60 * 1000,
    stdout: (d) => process.stdout.write(d),
    stderr: (d) => process.stderr.write(d),
  });
  if (res.code !== 0) {
    throw new Error(
      `web build failed with exit code ${res.code} (output=${outputDir})`,
    );
  }
}

async function runOne({
  runIndex,
  sessionsDir,
  startMarkName,
  markName,
  sessionTimeoutMs,
  markTimeoutMs,
  afterMarkDelayMs,
  webUrl,
  userDataDir,
  executablePath,
  headless,
  log,
}) {
  const before = listSessionIds(sessionsDir);

  const t0 = Date.now();
  const enableExtensions = webExtensionsEnabled();
  if (headless && enableExtensions) {
    throw new Error(
      [
        'Web perf runner is configured to allow browser extensions by default,',
        'but extensions are not reliable in headless mode.',
        '',
        'Fix options:',
        '- Run with --headed (recommended for extension-dependent flows)',
        '- Or set PERF_WEB_DISABLE_EXTENSIONS=1 if you really need headless',
      ].join('\n'),
    );
  }
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: enableExtensions ? false : headless,
    executablePath,
    // Playwright's Chromium default args include `--disable-extensions`, which breaks
    // extension-based wallet flows. Remove it when requested.
    ignoreDefaultArgs: enableExtensions ? ['--disable-extensions'] : undefined,
    args: [
      '--no-first-run',
      '--no-default-browser-check',
      ...(enableExtensions ? [] : ['--disable-background-networking']),
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      ...(process.env.PERF_WEB_EXTENSION_DIR
        ? [
            `--disable-extensions-except=${process.env.PERF_WEB_EXTENSION_DIR}`,
            `--load-extension=${process.env.PERF_WEB_EXTENSION_DIR}`,
          ]
        : []),
    ],
  });

  try {
    log(`run#${runIndex}: open ${webUrl}`);
    const page = context.pages()[0] || (await context.newPage());
    await page.goto(webUrl, { waitUntil: 'domcontentloaded' });

    log(`run#${runIndex}: waiting for sessionId...`);
    const sessionId = await waitForNewSessionId({
      sessionsDir,
      beforeSet: before,
      timeoutMs: sessionTimeoutMs,
    });
    log(`run#${runIndex}: sessionId=${sessionId}`);

    // Require a real refresh cycle so metrics are meaningful.
    log(`run#${runIndex}: waiting for start mark "${startMarkName}"...`);
    await waitForMark({
      markLogPath: path.join(sessionsDir, sessionId, 'mark.log'),
      markName: startMarkName,
      timeoutMs: markTimeoutMs,
    });
    log(`run#${runIndex}: start mark received`);

    log(`run#${runIndex}: waiting for done mark "${markName}"...`);
    await waitForMark({
      markLogPath: path.join(sessionsDir, sessionId, 'mark.log'),
      markName,
      timeoutMs: markTimeoutMs,
    });
    log(`run#${runIndex}: done mark received`);

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
  const startMarkName =
    process.env.PERF_START_MARK_NAME || 'Home:refresh:start:tokens';

  const afterMarkDelayMs = Number(process.env.AFTER_MARK_DELAY_MS) || 4000;
  const markTimeoutMs = Number(process.env.PERF_MARK_TIMEOUT_MS) || 120_000;
  const sessionTimeoutMs =
    Number(process.env.PERF_SESSION_TIMEOUT_MS) || 5 * 60_000;

  const outputRoot =
    process.env.PERF_JOB_OUTPUT_ROOT ||
    path.join(repoRoot, 'development', 'perf-ci', 'output');
  const jobId = process.env.PERF_JOB_ID || `web-release-${nowId()}`;
  const outputDir = path.join(outputRoot, jobId);
  const derivedDir = path.join(outputDir, 'derived');

  const thresholdsPath =
    process.env.PERF_THRESHOLDS_PATH ||
    path.join(
      repoRoot,
      'development',
      'perf-ci',
      'thresholds',
      'web.release.json',
    );

  ensureDir(outputDir);
  ensureDir(derivedDir);

  log('start', { jobId, outputDir });

  const buildDir =
    process.env.PERF_WEB_BUILD_DIR ||
    path.join(repoRoot, 'apps', 'web', 'web-build');

  const profileDir =
    process.env.PERF_WEB_PROFILE_DIR ||
    localConfig.webProfileDir ||
    path.join(os.homedir(), 'perf-profiles', 'web');
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

  const enableExtensions = webExtensionsEnabled();
  // Extensions are generally not supported/reliable in headless mode.
  // Default to headed unless explicitly requested otherwise.
  const headless = hasFlag('--headless');

  const startedAt = new Date().toISOString();
  const meta = {
    startedAt,
    sessionsDir,
    serverUrl,
    markName,
    startMarkName,
    runCount,
    mode: 'release',
    web: {
      buildDir,
      profileDir,
      headless,
      enableExtensions,
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
  let staticServer = null;

  try {
    log('config', {
      sessionsDir,
      serverUrl,
      buildDir,
      profileDir,
      headless,
      enableExtensions,
      markName,
      startMarkName,
      runCount,
    });
    ensureSessionsDirWritable(sessionsDir);

    if (serverAutostart) {
      log('checking perf-server...');
      perfServer = await ensurePerfServerRunning({
        repoRoot,
        sessionsDir,
        serverUrl,
        outputDir,
        oneshot: serverOneshot,
      });
      log(
        perfServer.started
          ? 'perf-server started'
          : 'perf-server already running',
        {
          outputDir: perfServer.health?.outputDir,
        },
      );
    } else {
      log('checking perf-server (autostart disabled)...');
      await checkPerfServer(serverUrl);
    }

    if (process.env.PERF_SKIP_BUILD === '1') {
      log('web build skipped (PERF_SKIP_BUILD=1)');
    } else {
      log('web build start...');
    }
    await buildWeb({ repoRoot, outputDir });
    if (process.env.PERF_SKIP_BUILD !== '1') {
      log('web build done');
    }
    if (!fileExists(path.join(buildDir, 'index.html'))) {
      throw new Error(`web build output missing index.html: ${buildDir}`);
    }

    log('starting static server...');
    staticServer = await startStaticServer({
      rootDir: buildDir,
      host: '127.0.0.1',
      // IMPORTANT: when using browser-extension wallets, permissions are bound to the site origin.
      // Use a stable port by default so the "connected site" state persists across runs.
      port:
        Number(process.env.PERF_WEB_PORT) ||
        Number(localConfig.webPort) ||
        3123,
      spaFallback: true,
    });

    const webUrl = process.env.PERF_WEB_URL || staticServer.baseUrl;
    log('static server ready', { webUrl });

    const runs = [];
    for (let i = 1; i <= runCount; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const r = await runOne({
        runIndex: i,
        sessionsDir,
        startMarkName,
        markName,
        sessionTimeoutMs,
        markTimeoutMs,
        afterMarkDelayMs,
        webUrl,
        userDataDir: profileDir,
        executablePath,
        headless,
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
      log('derive-session', { sessionId });
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
    log('agg', agg);
    if (exceed.triggered) {
      log('REGRESSION', exceed.reasons);
    } else {
      log('OK');
    }

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
    log('report written', path.join(outputDir, 'report.json'));

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
        text: `FAILED: Web release Perf Regression Guard\n${message}\noutput: ${outputDir}`,
      }).catch(() => {});
    }

    jobState.status = 'failed';
    jobState.meta.finishedAt = new Date().toISOString();
    writeJson(path.join(outputDir, 'job-meta.json'), jobState);
    return 2;
  } finally {
    if (staticServer) {
      await staticServer.close().catch(() => {});
    }
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
