#!/usr/bin/env node

/**
 * Warm Web viewport-resize performance guard.
 *
 * Builds and serves the production Web app, opens the prepared persistent
 * profile, then measures repeated viewport transitions around Tamagui media
 * boundaries. Use PERF_WEB_RESIZE_BASELINE_REPORT to turn a candidate run into
 * a baseline comparison.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const { chromium } = require('playwright-core');

const { withBuildLock } = require('./lib/buildLock');
const { findChromiumExecutable } = require('./lib/chromium');
const { readPerfCiLocalConfig } = require('./lib/config');
const {
  execCmd,
  formatExecResultError,
  withRepoNodeBin,
} = require('./lib/exec');
const { ensureDir, fileExists, readJson, writeJson } = require('./lib/fs');
const { nowId } = require('./lib/id');
const { median } = require('./lib/metrics');
const { startStaticServer } = require('./lib/staticServer');
const {
  assertBuildScriptsLoaded,
  scriptAssetNamesFromHtml,
} = require('./lib/webBuildIdentity');
const {
  aggregateResizeRuns,
  compareResizeSummaries,
} = require('./lib/webResizeMetrics');

// cspell:ignore recalc

const WIDTH_HEIGHT = 900;
const DEFAULT_TARGET_NAME = 'market-list';
const TARGETS = {
  home: {
    name: 'home',
    path: '/',
    readySelector: '[data-testid="wallet-refresh-manually"]',
    businessReady: null,
    defaultScenarioNames: ['control-gt-md', 'cross-md'],
  },
  'market-list': {
    name: 'market-list',
    path: '/market',
    readySelector: '[data-testid="market-normal-token-list"]',
    businessReady: 'marketList',
    defaultScenarioNames: ['market-control-lg', 'market-cross-lg'],
  },
};
const WIDTH_SCENARIO_NAMES = [
  'cross-sm',
  'cross-md',
  'cross-2md',
  'cross-lg',
  'cross-xl',
  'cross-2xl',
];
const SCENARIOS = [
  {
    name: 'market-control-lg',
    sizes: [
      { width: 984, height: WIDTH_HEIGHT },
      { width: 1000, height: WIDTH_HEIGHT },
    ],
    expectedVisibleMarketColumnCounts: [8, 8],
  },
  {
    name: 'market-cross-lg',
    sizes: [
      { width: 1016, height: WIDTH_HEIGHT },
      { width: 1032, height: WIDTH_HEIGHT },
    ],
    expectedVisibleMarketColumnCounts: [8, 9],
  },
  {
    name: 'market-control-xl',
    sizes: [
      { width: 1240, height: WIDTH_HEIGHT },
      { width: 1256, height: WIDTH_HEIGHT },
    ],
    expectedVisibleMarketColumnCounts: [9, 9],
  },
  {
    name: 'market-cross-xl',
    sizes: [
      { width: 1272, height: WIDTH_HEIGHT },
      { width: 1288, height: WIDTH_HEIGHT },
    ],
    expectedVisibleMarketColumnCounts: [9, 11],
  },
  {
    name: 'control-gt-md',
    sizes: [
      { width: 780, height: WIDTH_HEIGHT },
      { width: 850, height: WIDTH_HEIGHT },
    ],
  },
  {
    name: 'cross-sm',
    sizes: [
      { width: 632, height: WIDTH_HEIGHT },
      { width: 648, height: WIDTH_HEIGHT },
    ],
  },
  {
    name: 'cross-md',
    sizes: [
      { width: 760, height: WIDTH_HEIGHT },
      { width: 780, height: WIDTH_HEIGHT },
    ],
  },
  {
    name: 'cross-2md',
    sizes: [
      { width: 888, height: WIDTH_HEIGHT },
      { width: 904, height: WIDTH_HEIGHT },
    ],
  },
  {
    name: 'cross-lg',
    sizes: [
      { width: 1016, height: WIDTH_HEIGHT },
      { width: 1032, height: WIDTH_HEIGHT },
    ],
  },
  {
    name: 'cross-xl',
    sizes: [
      { width: 1272, height: WIDTH_HEIGHT },
      { width: 1288, height: WIDTH_HEIGHT },
    ],
  },
  {
    name: 'cross-2xl',
    sizes: [
      { width: 1528, height: WIDTH_HEIGHT },
      { width: 1544, height: WIDTH_HEIGHT },
    ],
  },
  {
    name: 'cross-height',
    sizes: [
      { width: 1024, height: 812 },
      { width: 1024, height: 828 },
    ],
  },
];

function hasFlag(name) {
  return process.argv.includes(name);
}

function numberEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function booleanEnv(name) {
  return process.env[name] === '1' || process.env[name] === 'true';
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function percentile(values, ratio) {
  const sorted = values
    .filter((value) => Number.isFinite(value))
    .slice()
    .toSorted((a, b) => a - b);
  if (!sorted.length) return null;
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * ratio) - 1),
  );
  return sorted[index];
}

function sum(values) {
  return values.reduce(
    (total, value) => total + (Number.isFinite(value) ? value : 0),
    0,
  );
}

function max(values) {
  const finite = values.filter((value) => Number.isFinite(value));
  return finite.length ? Math.max(...finite) : null;
}

function parseTarget() {
  const targetName = process.env.PERF_WEB_RESIZE_TARGET || DEFAULT_TARGET_NAME;
  const target = TARGETS[targetName];
  if (!target) {
    throw new Error(
      `Unknown Web resize target: ${targetName}. Known: ${Object.keys(TARGETS).join(', ')}`,
    );
  }
  return target;
}

function parseScenarios(
  defaultScenarioNames = TARGETS.home.defaultScenarioNames,
) {
  const raw = process.env.PERF_WEB_RESIZE_SCENARIOS || 'default';
  const requested = raw
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
  const names = [];

  for (const name of requested) {
    if (name === 'default') {
      names.push(...defaultScenarioNames);
    } else if (name === 'all-width-breakpoints') {
      names.push(...WIDTH_SCENARIO_NAMES);
    } else if (name === 'all') {
      names.push(...SCENARIOS.map((scenario) => scenario.name));
    } else {
      names.push(name);
    }
  }

  const selected = [...new Set(names)].map((name) => {
    const scenario = SCENARIOS.find((item) => item.name === name);
    if (!scenario) {
      throw new Error(`Unknown Web resize scenario: ${name}`);
    }
    return scenario;
  });
  if (!selected.length) {
    throw new Error('At least one Web resize scenario is required');
  }
  return selected;
}

async function waitForBusinessReady({ page, businessReady, timeoutMs }) {
  if (!businessReady) return null;
  if (businessReady !== 'marketList') {
    throw new Error(`Unknown Web resize business readiness: ${businessReady}`);
  }

  await page.waitForFunction(
    () => {
      const perfGlobal = globalThis;
      const readyAt = Number(perfGlobal.__onekeyMarketListReadyAt);
      const readyCount = Number(perfGlobal.__onekeyMarketListReadyCount);
      const list = document.querySelector(
        '[data-testid="market-normal-token-list"]',
      );
      return (
        (Number.isFinite(readyAt) && readyAt > 0 && readyCount > 0) ||
        (list?.textContent?.trim()?.length || 0) > 200
      );
    },
    undefined,
    { timeout: timeoutMs },
  );

  return page.evaluate(() => {
    const perfGlobal = globalThis;
    const readyAt = Number(perfGlobal.__onekeyMarketListReadyAt);
    const readyCount = Number(perfGlobal.__onekeyMarketListReadyCount);
    const list = document.querySelector(
      '[data-testid="market-normal-token-list"]',
    );
    return {
      name: 'marketList',
      readyAt: Number.isFinite(readyAt) && readyAt > 0 ? readyAt : null,
      readyCount:
        Number.isFinite(readyCount) && readyCount > 0 ? readyCount : 0,
      domTextLength: list?.textContent?.trim()?.length || 0,
    };
  });
}

async function readVisibleMarketColumns(page) {
  return page.evaluate(() => {
    const prefix = 'list-column-';
    const visibleColumnNames = new Set();
    for (const element of document.querySelectorAll(
      '[data-testid^="list-column-"]',
    )) {
      const testId = element.getAttribute('data-testid');
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      if (
        testId?.startsWith(prefix) &&
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        rect.width > 0 &&
        rect.height > 0
      ) {
        visibleColumnNames.add(testId.slice(prefix.length));
      }
    }
    return [...visibleColumnNames].toSorted();
  });
}

async function verifyScenarioFixture({ page, scenario }) {
  const expectedCounts = scenario.expectedVisibleMarketColumnCounts;
  if (!expectedCounts) return [];

  const fixtureStates = [];
  for (let index = 0; index < scenario.sizes.length; index += 1) {
    const size = scenario.sizes[index];
    // eslint-disable-next-line no-await-in-loop
    await page.setViewportSize(size);
    // eslint-disable-next-line no-await-in-loop
    await waitForAnimationFrames(page);
    // eslint-disable-next-line no-await-in-loop
    const visibleColumns = await readVisibleMarketColumns(page);
    const expectedCount = expectedCounts[index];
    const state = {
      size,
      expectedCount,
      visibleCount: visibleColumns.length,
      visibleColumns,
    };
    fixtureStates.push(state);
    if (visibleColumns.length !== expectedCount) {
      throw new Error(
        `${scenario.name}: expected ${expectedCount} visible Market columns at ${size.width}x${size.height}, found ${visibleColumns.length}: ${visibleColumns.join(', ')}`,
      );
    }
  }
  return fixtureStates;
}

function webExtensionsEnabled() {
  return process.env.PERF_WEB_DISABLE_EXTENSIONS !== '1';
}

function installResizeObservers() {
  if (globalThis.__onekeyResizePerf) return;

  const state = {
    active: false,
    generation: 0,
    frameDeltas: [],
    longTasks: [],
    resizeEventCount: 0,
  };
  globalThis.__onekeyResizePerf = state;

  globalThis.addEventListener('resize', () => {
    if (state.active) state.resizeEventCount += 1;
  });

  if ('PerformanceObserver' in globalThis) {
    try {
      const observer = new PerformanceObserver((list) => {
        if (!state.active) return;
        state.longTasks.push(
          ...list.getEntries().map((entry) => ({
            startTime: entry.startTime,
            duration: entry.duration,
            name: entry.name,
          })),
        );
      });
      observer.observe({ type: 'longtask', buffered: false });
    } catch {
      // Long-task entries are not exposed in every browser mode.
    }
  }
}

async function waitForAnimationFrames(page, count = 2) {
  await page.evaluate(async (frameCount) => {
    for (let index = 0; index < frameCount; index += 1) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  }, count);
}

async function startPageMeasurement(page) {
  return page.evaluate(() => {
    const state = globalThis.__onekeyResizePerf;
    if (!state) throw new Error('Resize observers are not installed');

    state.active = true;
    state.generation += 1;
    state.frameDeltas = [];
    state.longTasks = [];
    state.resizeEventCount = 0;
    const generation = state.generation;
    let lastFrameTime = null;

    const onFrame = (frameTime) => {
      if (!state.active || state.generation !== generation) return;
      if (lastFrameTime !== null) {
        state.frameDeltas.push(frameTime - lastFrameTime);
      }
      lastFrameTime = frameTime;
      requestAnimationFrame(onFrame);
    };
    requestAnimationFrame(onFrame);

    return performance.now();
  });
}

async function stopPageMeasurement(page) {
  return page.evaluate(() => {
    const state = globalThis.__onekeyResizePerf;
    state.active = false;
    state.generation += 1;
    return {
      endTime: performance.now(),
      frameDeltas: state.frameDeltas.slice(),
      longTasks: state.longTasks.slice(),
      resizeEventCount: state.resizeEventCount,
    };
  });
}

function cdpMetricsToMap(payload) {
  return Object.fromEntries(
    (payload.metrics || []).map((metric) => [metric.name, metric.value]),
  );
}

function durationDeltaMs(before, after, metricName) {
  const beforeValue = before[metricName];
  const afterValue = after[metricName];
  if (!Number.isFinite(beforeValue) || !Number.isFinite(afterValue)) {
    return null;
  }
  return Math.max(0, (afterValue - beforeValue) * 1000);
}

async function getCdpPerformanceMetrics(cdp) {
  return cdpMetricsToMap(await cdp.send('Performance.getMetrics'));
}

async function startBrowserTrace(cdp) {
  const traceEvents = [];
  let resolveComplete;
  const complete = new Promise((resolve) => {
    resolveComplete = resolve;
  });
  const onData = (event) => traceEvents.push(...event.value);
  const onComplete = () => resolveComplete();
  cdp.on('Tracing.dataCollected', onData);
  cdp.on('Tracing.tracingComplete', onComplete);

  const categories = [
    'devtools.timeline',
    'blink.user_timing',
    'v8.execute',
    ...(booleanEnv('PERF_WEB_RESIZE_CPU_PROFILE')
      ? [
          'disabled-by-default-v8.cpu_profiler',
          'disabled-by-default-v8.cpu_profiler.hires',
        ]
      : []),
  ];
  await cdp.send('Tracing.start', {
    categories: categories.join(','),
    transferMode: 'ReportEvents',
  });

  return async (tracePath) => {
    await cdp.send('Tracing.end');
    await Promise.race([
      complete,
      delay(30_000).then(() => {
        throw new Error('Timed out while collecting Chrome trace data');
      }),
    ]);
    cdp.off('Tracing.dataCollected', onData);
    cdp.off('Tracing.tracingComplete', onComplete);
    fs.writeFileSync(tracePath, JSON.stringify({ traceEvents }));
  };
}

async function runScenario({
  page,
  cdp,
  scenario,
  transitionCount,
  warmupTransitionCount,
  log,
}) {
  const [firstSize, secondSize] = scenario.sizes;
  log(`scenario=${scenario.name}: verify fixture`);
  const fixtureStates = await verifyScenarioFixture({ page, scenario });
  log(`scenario=${scenario.name}: warmup`);
  await page.setViewportSize(firstSize);
  await waitForAnimationFrames(page);
  for (let index = 0; index < warmupTransitionCount; index += 1) {
    const target = index % 2 === 0 ? secondSize : firstSize;
    // eslint-disable-next-line no-await-in-loop
    await page.setViewportSize(target);
    // eslint-disable-next-line no-await-in-loop
    await waitForAnimationFrames(page);
  }
  await page.setViewportSize(firstSize);
  await waitForAnimationFrames(page);
  await page.waitForTimeout(250);

  await page.evaluate(
    (name) => performance.mark(`onekey-resize:${name}:start`),
    scenario.name,
  );
  const measurementStart = await startPageMeasurement(page);
  const before = await getCdpPerformanceMetrics(cdp);
  const settleDurations = [];

  log(
    `scenario=${scenario.name}: measure ${transitionCount} viewport transitions`,
  );
  for (let index = 0; index < transitionCount; index += 1) {
    const target = index % 2 === 0 ? secondSize : firstSize;
    // eslint-disable-next-line no-await-in-loop
    const transitionStart = await page.evaluate(() => performance.now());
    // eslint-disable-next-line no-await-in-loop
    await page.setViewportSize(target);
    // eslint-disable-next-line no-await-in-loop
    const transitionEnd = await page.evaluate(async (expectedSize) => {
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      );
      if (
        globalThis.innerWidth !== expectedSize.width ||
        globalThis.innerHeight !== expectedSize.height
      ) {
        throw new Error(
          `Viewport mismatch: expected ${expectedSize.width}x${expectedSize.height}, ` +
            `received ${globalThis.innerWidth}x${globalThis.innerHeight}`,
        );
      }
      return performance.now();
    }, target);
    settleDurations.push(transitionEnd - transitionStart);
  }

  await waitForAnimationFrames(page);
  const pageMeasurement = await stopPageMeasurement(page);
  const after = await getCdpPerformanceMetrics(cdp);
  await page.evaluate(
    (name) => performance.mark(`onekey-resize:${name}:end`),
    scenario.name,
  );

  const frameDeltas = pageMeasurement.frameDeltas.filter(
    (value) => Number.isFinite(value) && value >= 0,
  );
  const longTaskDurations = pageMeasurement.longTasks.map(
    (entry) => entry.duration,
  );
  const frameBudgetMs = 1000 / 60;
  const heapBeforeBytes = before.JSHeapUsedSize ?? null;
  const heapAfterBytes = after.JSHeapUsedSize ?? null;

  return {
    name: scenario.name,
    sizes: scenario.sizes,
    fixtureStates,
    transitionCount,
    warmupTransitionCount,
    metrics: {
      measurementDurationMs: pageMeasurement.endTime - measurementStart,
      settleMedianMs: median(settleDurations),
      settleP95Ms: percentile(settleDurations, 0.95),
      settleMaxMs: max(settleDurations),
      taskDurationMs: durationDeltaMs(before, after, 'TaskDuration'),
      scriptDurationMs: durationDeltaMs(before, after, 'ScriptDuration'),
      recalcStyleDurationMs: durationDeltaMs(
        before,
        after,
        'RecalcStyleDuration',
      ),
      layoutDurationMs: durationDeltaMs(before, after, 'LayoutDuration'),
      longTaskCount: longTaskDurations.length,
      longTaskTotalMs: sum(longTaskDurations),
      longTaskMaxMs: max(longTaskDurations) || 0,
      maxFrameDurationMs: max(frameDeltas),
      slowFrameCount: frameDeltas.filter((value) => value > 20).length,
      droppedFrameEstimate: sum(
        frameDeltas.map((value) =>
          Math.max(0, Math.round(value / frameBudgetMs) - 1),
        ),
      ),
      resizeEventCount: pageMeasurement.resizeEventCount,
      heapBeforeBytes,
      heapAfterBytes,
      heapDeltaBytes:
        Number.isFinite(heapBeforeBytes) && Number.isFinite(heapAfterBytes)
          ? heapAfterBytes - heapBeforeBytes
          : null,
    },
    transitions: settleDurations,
  };
}

async function buildWeb({ repoRoot, outputDir, log }) {
  if (process.env.PERF_SKIP_BUILD === '1') {
    log('web build skipped (PERF_SKIP_BUILD=1)');
    return;
  }

  const result = await withBuildLock(
    'webpack-build',
    () =>
      execCmd('yarn', ['workspace', '@onekeyhq/web', 'build'], {
        cwd: repoRoot,
        env: withRepoNodeBin(repoRoot, {
          PERF_MONITOR_ENABLED: booleanEnv('PERF_WEB_RESIZE_FUNCTION_MONITOR')
            ? '1'
            : '0',
        }),
        timeoutMs: numberEnv('PERF_WEB_BUILD_TIMEOUT_MS', 30 * 60 * 1000),
        killProcessGroup: true,
        stdout: (data) => process.stdout.write(data),
        stderr: (data) => process.stderr.write(data),
      }),
    { log },
  );
  if (result.code !== 0) {
    throw new Error(formatExecResultError('web build', result, { outputDir }));
  }
}

async function readGitMeta(repoRoot) {
  const meta = {};
  const sha = await execCmd('git', ['rev-parse', 'HEAD'], { cwd: repoRoot });
  if (sha.code === 0) meta.sha = String(sha.stdout).trim();
  const branch = await execCmd('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
    cwd: repoRoot,
  });
  if (branch.code === 0) meta.branch = String(branch.stdout).trim();
  return meta;
}

async function runOne({
  runIndex,
  scenarios,
  transitionCount,
  warmupTransitionCount,
  webUrl,
  readySelector,
  businessReady,
  readyTimeoutMs,
  waitAfterReadyMs,
  profileDir,
  executablePath,
  headless,
  enableExtensions,
  traceEnabled,
  expectedBuildScripts,
  outputDir,
  log,
}) {
  if (headless && enableExtensions) {
    throw new Error(
      'Headless resize runs require PERF_WEB_DISABLE_EXTENSIONS=1',
    );
  }

  const initialViewport = scenarios[0].sizes[0];
  const context = await chromium.launchPersistentContext(profileDir, {
    headless: enableExtensions ? false : headless,
    executablePath,
    viewport: initialViewport,
    ignoreDefaultArgs: enableExtensions ? ['--disable-extensions'] : undefined,
    args: [
      '--no-first-run',
      '--no-default-browser-check',
      '--enable-precise-memory-info',
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
  let cdp = null;
  let stopTrace = null;
  let tracePath = null;

  try {
    await context.addInitScript(installResizeObservers);
    const page = context.pages()[0] || (await context.newPage());
    const pageErrors = [];
    const consoleErrors = [];
    page.on('pageerror', (error) =>
      pageErrors.push({
        at: Date.now(),
        message: error?.message || String(error),
        stack: error?.stack || null,
      }),
    );
    page.on('console', (message) => {
      if (message.type() === 'error') {
        consoleErrors.push({
          at: Date.now(),
          text: message.text(),
          location: message.location(),
        });
      }
    });
    // A persistent profile keeps the watch-only wallet state, but it also keeps
    // PWA caches. Detach a restored page from any old controller and clear only
    // Service Worker/network caches so a previous instrumented build cannot
    // contaminate the production baseline. IndexedDB/localStorage stay intact.
    await page.goto('about:blank');
    cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.clearBrowserCache');
    await cdp.send('Storage.clearDataForOrigin', {
      origin: new URL(webUrl).origin,
      storageTypes: 'service_workers,cache_storage',
    });
    await cdp.send('Network.disable');

    await page.setViewportSize(initialViewport);
    log(`run#${runIndex}: open ${webUrl}`);
    await page.goto(webUrl, { waitUntil: 'domcontentloaded' });
    const loadedBuildScripts = await page.evaluate(() =>
      [...document.scripts]
        .map((script) => script.src)
        .filter(Boolean)
        .map((source) => new URL(source).pathname.split('/').pop())
        .filter(Boolean),
    );
    assertBuildScriptsLoaded({
      expected: expectedBuildScripts,
      loaded: loadedBuildScripts,
    });
    log(`run#${runIndex}: build identity verified`);
    log(`run#${runIndex}: wait for ${readySelector}`);
    let businessReadyStatus = null;
    try {
      await page.locator(readySelector).waitFor({
        state: 'visible',
        timeout: readyTimeoutMs,
      });
      businessReadyStatus = await waitForBusinessReady({
        page,
        businessReady,
        timeoutMs: readyTimeoutMs,
      });
    } catch (error) {
      const diagnosticPath = path.join(
        outputDir,
        `page-readiness-run-${runIndex}.json`,
      );
      const screenshotPath = path.join(
        outputDir,
        `page-readiness-run-${runIndex}.png`,
      );
      writeJson(diagnosticPath, {
        url: page.url(),
        title: await page.title().catch(() => null),
        bodyText: await page
          .locator('body')
          .innerText({ timeout: 5000 })
          .catch(() => null),
        readySelector,
        businessReady,
        loadedBuildScripts,
        pageErrors,
        consoleErrors,
      });
      await page
        .screenshot({ path: screenshotPath, fullPage: true })
        .catch(() => {});
      throw error;
    }
    await page.waitForTimeout(waitAfterReadyMs);
    await cdp.send('Performance.enable');
    if (traceEnabled) {
      tracePath = path.join(outputDir, `chrome-trace-run-${runIndex}.json`);
      stopTrace = await startBrowserTrace(cdp);
    }

    const scenarioResults = [];
    for (const scenario of scenarios) {
      // eslint-disable-next-line no-await-in-loop
      const result = await runScenario({
        page,
        cdp,
        scenario,
        transitionCount,
        warmupTransitionCount,
        log: (message) => log(`run#${runIndex}: ${message}`),
      });
      scenarioResults.push(result);
    }

    if (stopTrace) {
      await stopTrace(tracePath);
      stopTrace = null;
    }

    return {
      runIndex,
      tracePath,
      loadedBuildScripts,
      businessReadyStatus,
      pageErrorCount: pageErrors.length,
      consoleErrorCount: consoleErrors.length,
      pageErrors,
      consoleErrors,
      scenarios: scenarioResults,
    };
  } finally {
    if (stopTrace && tracePath) {
      await stopTrace(tracePath).catch(() => {});
    }
    if (cdp) await cdp.detach().catch(() => {});
    await context.close().catch(() => {});
  }
}

async function main() {
  const repoRoot = path.join(__dirname, '..', '..');
  const localConfig = readPerfCiLocalConfig(repoRoot) || {};
  const log = (...args) => {
    // eslint-disable-next-line no-console
    console.log('[perf:web:resize]', ...args);
  };
  const outputRoot =
    process.env.PERF_JOB_OUTPUT_ROOT ||
    path.join(repoRoot, 'development', 'perf-ci', 'output');
  const jobId = process.env.PERF_JOB_ID || `web-resize-${nowId()}`;
  const outputDir = path.join(outputRoot, jobId);
  const buildDir =
    process.env.PERF_WEB_BUILD_DIR ||
    path.join(repoRoot, 'apps', 'web', 'web-build');
  const profileDir =
    process.env.PERF_WEB_PROFILE_DIR ||
    localConfig.webProfileDir ||
    path.join(os.homedir(), 'perf-profiles', 'web');
  const thresholdsPath =
    process.env.PERF_WEB_RESIZE_THRESHOLDS_PATH ||
    path.join(
      repoRoot,
      'development',
      'perf-ci',
      'thresholds',
      'web.resize.json',
    );
  const baselineReportPath =
    process.env.PERF_WEB_RESIZE_BASELINE_REPORT || null;
  const target = parseTarget();
  const scenarios = parseScenarios(target.defaultScenarioNames);
  const runCount = numberEnv('PERF_RUN_COUNT', 3);
  const transitionCount = numberEnv('PERF_WEB_RESIZE_TRANSITIONS', 20);
  const warmupTransitionCount = numberEnv(
    'PERF_WEB_RESIZE_WARMUP_TRANSITIONS',
    4,
  );
  const readySelector =
    process.env.PERF_WEB_RESIZE_READY_SELECTOR || target.readySelector;
  const readyTimeoutMs = numberEnv('PERF_WEB_RESIZE_READY_TIMEOUT_MS', 120_000);
  const waitAfterReadyMs = numberEnv(
    'PERF_WEB_RESIZE_WAIT_AFTER_READY_MS',
    5000,
  );
  const enableExtensions = webExtensionsEnabled();
  const headless = hasFlag('--headless');
  const traceEnabled = booleanEnv('PERF_WEB_RESIZE_TRACE');
  const cpuProfileEnabled = booleanEnv('PERF_WEB_RESIZE_CPU_PROFILE');
  const functionMonitorEnabled = booleanEnv('PERF_WEB_RESIZE_FUNCTION_MONITOR');
  const executablePath = findChromiumExecutable(
    localConfig.chromeExecutablePath || null,
  );

  ensureDir(outputDir);
  ensureDir(profileDir);

  const meta = {
    startedAt: new Date().toISOString(),
    jobId,
    targetKey: 'web.resize',
    mode: 'release',
    git: await readGitMeta(repoRoot),
    web: {
      buildDir,
      profileDir,
      executablePath,
      headless,
      enableExtensions,
      target: target.name,
      path: target.path,
      readySelector,
      businessReady: target.businessReady,
    },
    runCount,
    transitionCount,
    warmupTransitionCount,
    scenarios: scenarios.map((scenario) => scenario.name),
    traceEnabled,
    cpuProfileEnabled,
    functionMonitorEnabled,
    baselineReportPath,
    thresholdsPath,
  };
  writeJson(path.join(outputDir, 'job-meta.json'), {
    status: 'running',
    meta,
  });

  let staticServer = null;
  try {
    log('start', { jobId, outputDir });
    if (!executablePath) {
      throw new Error('Chromium/Chrome/Edge executable not found');
    }
    await buildWeb({ repoRoot, outputDir, log });
    if (!fileExists(path.join(buildDir, 'index.html'))) {
      throw new Error(`Web build output missing index.html: ${buildDir}`);
    }
    const expectedBuildScripts = scriptAssetNamesFromHtml(
      fs.readFileSync(path.join(buildDir, 'index.html'), 'utf8'),
    );
    if (!expectedBuildScripts.length) {
      throw new Error(
        `Web build index contains no external scripts: ${buildDir}`,
      );
    }
    meta.web.expectedBuildScripts = expectedBuildScripts;

    staticServer = await startStaticServer({
      rootDir: buildDir,
      host: '127.0.0.1',
      port:
        Number(process.env.PERF_WEB_PORT) ||
        Number(localConfig.webPort) ||
        3123,
      spaFallback: true,
    });
    const webUrl =
      process.env.PERF_WEB_URL ||
      new URL(target.path, `${staticServer.baseUrl}/`).toString();
    meta.web.url = webUrl;
    const runs = [];

    for (let runIndex = 1; runIndex <= runCount; runIndex += 1) {
      // eslint-disable-next-line no-await-in-loop
      const run = await runOne({
        runIndex,
        scenarios,
        transitionCount,
        warmupTransitionCount,
        webUrl,
        readySelector,
        businessReady: target.businessReady,
        readyTimeoutMs,
        waitAfterReadyMs,
        profileDir,
        executablePath,
        headless,
        enableExtensions,
        traceEnabled,
        expectedBuildScripts,
        outputDir,
        log,
      });
      runs.push(run);
      writeJson(path.join(outputDir, 'runs.json'), { meta, runs });
    }

    const summary = aggregateResizeRuns(runs);
    const thresholds = readJson(thresholdsPath);
    const baselineReport = baselineReportPath
      ? readJson(path.resolve(baselineReportPath))
      : null;
    const comparison = baselineReport
      ? compareResizeSummaries({
          current: summary,
          baseline: baselineReport.summary,
          thresholds,
        })
      : null;
    const report = {
      meta,
      outputDir,
      runs,
      summary,
      thresholds,
      baselineReportPath,
      comparison,
    };
    writeJson(path.join(outputDir, 'report.json'), report);
    writeJson(path.join(outputDir, 'job-result.json'), {
      status: comparison?.triggered ? 'regression' : 'ok',
      reasons: comparison?.reasons || [],
    });
    writeJson(path.join(outputDir, 'job-meta.json'), {
      status: comparison?.triggered ? 'regression' : 'ok',
      meta: { ...meta, finishedAt: new Date().toISOString() },
    });

    log('summary', summary);
    if (comparison?.triggered) {
      log('comparison failed', comparison.reasons);
      return 3;
    }
    log('report written', path.join(outputDir, 'report.json'));
    return 0;
  } catch (error) {
    const message = error?.stack || error?.message || String(error);
    writeJson(path.join(outputDir, 'job-error.json'), { error: message });
    writeJson(path.join(outputDir, 'job-meta.json'), {
      status: 'failed',
      meta: { ...meta, finishedAt: new Date().toISOString() },
    });
    // eslint-disable-next-line no-console
    console.error(message);
    return 2;
  } finally {
    if (staticServer) await staticServer.close().catch(() => {});
  }
}

module.exports = {
  SCENARIOS,
  TARGETS,
  installResizeObservers,
  main,
  parseScenarios,
  parseTarget,
  readVisibleMarketColumns,
  runScenario,
  verifyScenarioFixture,
  waitForBusinessReady,
};

if (require.main === module) {
  main().then((code) => process.exit(code));
}
