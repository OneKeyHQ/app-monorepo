#!/usr/bin/env node

/**
 * Web cold-start perf guard.
 *
 * Measures a production build with a fresh browser context, browser cache
 * disabled, and service workers blocked. This intentionally models first visit
 * cost rather than returning-user SW/cache behavior.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const { chromium } = require('playwright-core');

const {
  WEB_BUDGET_ARTIFACT,
  createWebColdAiHints,
  defaultSiblingPath,
  printAiTriageInstructions,
  writeAiHints,
} = require('./lib/budgetAiHints');
const { findChromiumExecutable } = require('./lib/chromium');
const {
  execCmd,
  formatExecResultError,
  withRepoNodeBin,
} = require('./lib/exec');
const { startStaticServer } = require('./lib/staticServer');

const MB = 1024 * 1024;

const DEFAULT_BUDGETS = {
  fcpMs: 1000,
  firstTextMs: 1000,
  jsDecodedBytes: 12 * MB,
  initialScriptRawBytes: 10 * MB,
  longTaskTotalMs: 900,
  largestPreLcpScriptDecodedBytes: 600 * 1024,
};

const RUNTIME_BUDGET_WARNING_RATIO = 0.05;
const RUNTIME_BUDGET_NAMES = new Set([
  'fcpMs',
  'firstTextMs',
  'businessReadyMs',
  'marketListReadyMs',
  'longTaskTotalMs',
]);

const ALL_SCENARIOS = [
  {
    name: 'root',
    path: '/',
    businessReady: null,
  },
  {
    name: 'market',
    path: '/market',
    businessReady: 'marketList',
  },
  {
    name: 'perps',
    path: '/perps',
    businessReady: null,
  },
  {
    name: 'swap',
    path: '/swap',
    businessReady: null,
  },
  {
    name: 'defi',
    path: '/defi',
    businessReady: null,
  },
  {
    name: 'referFriends',
    path: '/refer-friends',
    businessReady: null,
  },
];

const ENTRY_SCENARIO_NAMES = [
  'market',
  'perps',
  'swap',
  'defi',
  'referFriends',
];
const DEFAULT_SCENARIOS = ALL_SCENARIOS;

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

function formatBytes(value) {
  if (!Number.isFinite(value)) return 'n/a';
  if (value >= MB) return `${(value / MB).toFixed(2)} MiB`;
  return `${(value / 1024).toFixed(1)} KiB`;
}

function formatMs(value) {
  return Number.isFinite(value) ? `${Math.round(value)} ms` : 'n/a';
}

function median(values) {
  const sorted = values
    .filter((value) => Number.isFinite(value))
    .toSorted((a, b) => a - b);
  if (!sorted.length) return Number.NaN;
  return sorted[Math.floor(sorted.length / 2)];
}

function sum(values) {
  return values.reduce((total, value) => total + (Number(value) || 0), 0);
}

function readJsonIfExists(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function normalizeBudgetConfig(raw) {
  if (raw?.defaults || raw?.scenarios) {
    return {
      defaults: {
        ...DEFAULT_BUDGETS,
        ...raw.defaults,
      },
      scenarios: raw.scenarios || {},
    };
  }

  return {
    defaults: {
      ...DEFAULT_BUDGETS,
      ...raw,
    },
    scenarios: {},
  };
}

function loadBudgetConfig(repoRoot) {
  const budgetPath =
    process.env.PERF_WEB_COLD_BUDGET_PATH ||
    path.join(
      repoRoot,
      'development',
      'perf-ci',
      'thresholds',
      'web.cold.json',
    );
  return normalizeBudgetConfig(readJsonIfExists(budgetPath));
}

function expandScenarioNames(names) {
  const expanded = [];
  for (const rawName of names) {
    const name = rawName === 'refer-friends' ? 'referFriends' : rawName;
    if (name === 'all') {
      expanded.push(...ALL_SCENARIOS.map((scenario) => scenario.name));
    } else if (name === 'entries') {
      expanded.push(...ENTRY_SCENARIO_NAMES);
    } else {
      expanded.push(name);
    }
  }
  return [...new Set(expanded)];
}

function getScenarioBudgets(budgetConfig, scenario) {
  return {
    ...budgetConfig.defaults,
    ...budgetConfig.scenarios?.[scenario.name],
  };
}

function parseScenarios() {
  const scenarioNames = process.env.PERF_WEB_COLD_SCENARIOS?.split(',')
    .map((name) => name.trim())
    .filter(Boolean);
  if (!scenarioNames?.length) {
    return DEFAULT_SCENARIOS;
  }

  const scenariosByName = new Map(
    ALL_SCENARIOS.map((scenario) => [scenario.name, scenario]),
  );
  return expandScenarioNames(scenarioNames).map((name) => {
    const scenario = scenariosByName.get(name);
    if (!scenario) {
      throw new Error(
        `unknown PERF_WEB_COLD_SCENARIOS entry "${name}". Known: ${ALL_SCENARIOS.map(
          (item) => item.name,
        )
          .concat(['all', 'entries', 'refer-friends'])
          .join(', ')}`,
      );
    }
    return scenario;
  });
}

function scenarioUrl(baseUrl, scenario) {
  return new URL(scenario.path, baseUrl).toString();
}

function normalizeResourceUrl(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return String(url || '').split(/[?#]/)[0];
  }
}

function dedupeResourceEntries(entries) {
  const map = new Map();
  for (const entry of entries) {
    const key = normalizeResourceUrl(entry.name);
    const existing = map.get(key);
    if (existing) {
      existing.decodedBodySize = Math.max(
        existing.decodedBodySize || 0,
        entry.decodedBodySize || 0,
      );
      existing.encodedBodySize = Math.max(
        existing.encodedBodySize || 0,
        entry.encodedBodySize || 0,
      );
      existing.transferSize = Math.max(
        existing.transferSize || 0,
        entry.transferSize || 0,
      );
      existing.duration = Math.max(existing.duration || 0, entry.duration || 0);
      existing.startTime = Math.min(
        Number.isFinite(existing.startTime) ? existing.startTime : Infinity,
        Number.isFinite(entry.startTime) ? entry.startTime : Infinity,
      );
      existing.responseEnd = Math.max(
        existing.responseEnd || 0,
        entry.responseEnd || 0,
      );
    } else {
      map.set(key, { ...entry });
    }
  }
  return [...map.values()];
}

function parseInitialScriptFiles(buildDir) {
  const indexHtmlPath = path.join(buildDir, 'index.html');
  const html = fs.readFileSync(indexHtmlPath, 'utf8');
  const scripts = [];
  const scriptRegex = /<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
  let match = scriptRegex.exec(html);
  while (match) {
    const src = match[1];
    if (!/^https?:\/\//.test(src) && !src.startsWith('//')) {
      const urlPath = src.split('?')[0].replace(/^\//, '');
      const filePath = path.join(buildDir, urlPath);
      if (fs.existsSync(filePath)) {
        scripts.push({
          src,
          filePath,
          bytes: fs.statSync(filePath).size,
        });
      }
    }
    match = scriptRegex.exec(html);
  }
  return scripts;
}

async function buildWeb({ repoRoot, log }) {
  if (hasFlag('--skip-build') || process.env.PERF_SKIP_BUILD === '1') {
    log('skip build');
    return;
  }

  log('building @onekeyhq/web production bundle...');
  const result = await execCmd(
    'yarn',
    ['workspace', '@onekeyhq/web', 'build'],
    {
      cwd: repoRoot,
      env: withRepoNodeBin(repoRoot),
      timeoutMs: numberEnv('PERF_WEB_BUILD_TIMEOUT_MS', 30 * 60 * 1000),
      killProcessGroup: true,
      stdout: (d) => process.stdout.write(d),
      stderr: (d) => process.stderr.write(d),
    },
  );
  if (result.code !== 0) {
    throw new Error(formatExecResultError('web cold build', result));
  }
}

async function checkWebStartupGraphBudget({ repoRoot, buildDir, log }) {
  if (process.env.PERF_WEB_COLD_SKIP_STARTUP_GRAPH_BUDGET === '1') {
    log('skip web startup graph budget');
    return null;
  }

  const outputPath =
    process.env.PERF_WEB_STARTUP_GRAPH_OUT ||
    path.join(os.tmpdir(), `onekey-web-startup-graph-${Date.now()}.json`);
  const aiHintsJsonPath =
    process.env.WEB_STARTUP_AI_HINTS_JSON_PATH ||
    defaultSiblingPath(outputPath, '-ai-hints.json');
  const aiHintsMarkdownPath =
    process.env.WEB_STARTUP_AI_HINTS_MD_PATH ||
    defaultSiblingPath(outputPath, '-ai-hints.md');
  const result = await execCmd(
    'node',
    ['apps/web/scripts/check-startup-graph-budget.js', buildDir],
    {
      cwd: repoRoot,
      env: withRepoNodeBin(repoRoot, {
        WEB_STARTUP_BUILD_DIR: buildDir,
        WEB_STARTUP_REPORT_PATH: outputPath,
        WEB_STARTUP_AI_HINTS_JSON_PATH: aiHintsJsonPath,
        WEB_STARTUP_AI_HINTS_MD_PATH: aiHintsMarkdownPath,
        WEB_STARTUP_BUDGET_PATH:
          process.env.PERF_WEB_COLD_BUDGET_PATH ||
          path.join(
            repoRoot,
            'development',
            'perf-ci',
            'thresholds',
            'web.cold.json',
          ),
        WEB_STARTUP_BUDGET_FAIL: process.env.PERF_WEB_COLD_BUDGET_FAIL,
      }),
      timeoutMs: numberEnv('PERF_WEB_STARTUP_GRAPH_TIMEOUT_MS', 5 * 60 * 1000),
      killProcessGroup: true,
      stdout: (d) => process.stdout.write(d),
      stderr: (d) => process.stderr.write(d),
    },
  );
  if (result.code !== 0) {
    throw new Error(formatExecResultError('web startup graph budget', result));
  }
  return {
    report: readJsonIfExists(outputPath),
    reportPath: outputPath,
    aiHintsJsonPath,
    aiHintsMarkdownPath,
  };
}

function installMetricObservers() {
  globalThis.__onekeyColdStartMetrics = {
    firstContentfulPaint: null,
    largestContentfulPaint: null,
    largestContentfulPaintEntries: [],
    firstText: null,
    longTasks: [],
  };

  const metrics = globalThis.__onekeyColdStartMetrics;

  const observe = (type, callback) => {
    if (!('PerformanceObserver' in globalThis)) return;
    try {
      const observer = new PerformanceObserver((list) => {
        callback(list.getEntries());
      });
      observer.observe({ type, buffered: true });
    } catch {
      // Some browsers do not expose every observer type in every mode.
    }
  };

  observe('paint', (entries) => {
    const fcp = entries.find(
      (entry) => entry.name === 'first-contentful-paint',
    );
    if (fcp) {
      metrics.firstContentfulPaint = fcp.startTime;
    }
  });

  observe('largest-contentful-paint', (entries) => {
    const latest = entries[entries.length - 1];
    if (latest) {
      metrics.largestContentfulPaint = latest.startTime;
      metrics.largestContentfulPaintEntries.push(
        ...entries.map((entry) => {
          const element = entry.element;
          const text = element?.textContent?.trim()?.replace(/\s+/g, ' ');
          return {
            startTime: entry.startTime,
            renderTime: entry.renderTime,
            loadTime: entry.loadTime,
            size: entry.size,
            url: entry.url || null,
            tagName: element?.tagName || null,
            id: element?.id || null,
            testID: element?.getAttribute?.('data-testid') || null,
            className:
              typeof element?.className === 'string'
                ? element.className.slice(0, 160)
                : null,
            text: text ? text.slice(0, 160) : null,
          };
        }),
      );
    }
  });

  observe('longtask', (entries) => {
    metrics.longTasks.push(
      ...entries.map((entry) => ({
        startTime: entry.startTime,
        duration: entry.duration,
        name: entry.name,
      })),
    );
  });

  const checkText = () => {
    if (metrics.firstText !== null && metrics.firstText !== undefined) return;
    const text = document.body?.innerText?.trim();
    if (text) {
      metrics.firstText = performance.now();
      return;
    }
    requestAnimationFrame(checkText);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => checkText(), {
      once: true,
    });
  } else {
    checkText();
  }
}

async function waitForMarketListReady(page, timeoutMs) {
  await page
    .waitForFunction(
      () => {
        const perfGlobal = globalThis;
        const readyAt = Number(perfGlobal.__onekeyMarketListReadyAt);
        const readyCount = Number(perfGlobal.__onekeyMarketListReadyCount);
        if (
          Number.isFinite(readyAt) &&
          readyAt > 0 &&
          Number.isFinite(readyCount) &&
          readyCount > 0
        ) {
          return true;
        }
        return (
          document.querySelectorAll('[data-testid^="market-token-item-"]')
            .length >= 3
        );
      },
      { timeout: timeoutMs },
    )
    .catch(() => {});

  return page.evaluate(() => {
    const perfGlobal = globalThis;
    const readyAt = Number(perfGlobal.__onekeyMarketListReadyAt);
    const readyCount = Number(perfGlobal.__onekeyMarketListReadyCount);
    const domTokenItemCount = document.querySelectorAll(
      '[data-testid^="market-token-item-"]',
    ).length;
    const domList = document.querySelector(
      '[data-testid="market-normal-token-list"]',
    );
    const domTextLength = domList?.textContent?.trim()?.length || 0;
    const marketPerf = Array.isArray(perfGlobal.__onekeyMarketPerf)
      ? perfGlobal.__onekeyMarketPerf
      : [];
    return {
      readyAt: Number.isFinite(readyAt) && readyAt > 0 ? readyAt : null,
      readyCount:
        Number.isFinite(readyCount) && readyCount > 0 ? readyCount : 0,
      domTokenItemCount,
      domTextLength,
      marketPerf,
      ready:
        (Number.isFinite(readyAt) && readyAt > 0 && readyCount > 0) ||
        domTokenItemCount >= 3 ||
        domTextLength > 200,
    };
  });
}

async function waitForBusinessReady({ page, scenario, timeoutMs }) {
  if (scenario.businessReady === 'marketList') {
    return waitForMarketListReady(page, timeoutMs);
  }
  return null;
}

async function runOne({
  browser,
  url,
  scenario,
  runIndex,
  profileDir,
  waitAfterLoadMs,
  businessTimeoutMs,
  navigationTimeoutMs,
  log,
}) {
  const context = await browser.newContext({
    locale: process.env.PERF_WEB_COLD_LOCALE || 'zh-CN',
    serviceWorkers: 'block',
    viewport: {
      width: numberEnv('PERF_WEB_COLD_VIEWPORT_WIDTH', 1440),
      height: numberEnv('PERF_WEB_COLD_VIEWPORT_HEIGHT', 900),
    },
  });

  const failedRequests = [];
  const badResponses = [];
  const pageErrors = [];
  const consoleErrors = [];
  const enableCpuProfile = booleanEnv('PERF_WEB_COLD_CPU_PROFILE');
  const enableReactProbe = booleanEnv('PERF_WEB_COLD_REACT_PROBE');
  let cpuProfilePath = null;

  try {
    await context.addInitScript((enabled) => {
      if (!enabled) return;
      globalThis.__onekeyMarketReactPerfProbe = true;
      globalThis.__onekeyMarketReactPerf = [];
    }, enableReactProbe);
    await context.addInitScript(installMetricObservers);

    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    if (enableCpuProfile) {
      await cdp.send('Profiler.enable');
      await cdp.send('Profiler.start');
    }

    page.on('pageerror', (error) => {
      pageErrors.push({
        name: error.name,
        message: error.message,
        stack: error.stack,
      });
    });

    page.on('console', (message) => {
      if (message.type() !== 'error') return;
      consoleErrors.push({
        text: message.text(),
        location: message.location(),
      });
    });

    page.on('requestfailed', (request) => {
      failedRequests.push({
        url: request.url(),
        method: request.method(),
        resourceType: request.resourceType(),
        errorText: request.failure()?.errorText || '',
      });
    });

    page.on('response', (response) => {
      const status = response.status();
      if (status >= 400) {
        badResponses.push({
          url: response.url(),
          status,
        });
      }
    });

    log(`run#${runIndex} ${scenario.name}: open ${url}`);
    const response = await page.goto(url, {
      waitUntil: 'load',
      timeout: navigationTimeoutMs,
    });
    if (!response || response.status() >= 400) {
      throw new Error(
        `navigation failed: ${response ? response.status() : 'no response'}`,
      );
    }

    await page
      .waitForFunction(
        () =>
          globalThis.__onekeyColdStartMetrics?.firstText !== null &&
          globalThis.__onekeyColdStartMetrics?.firstText !== undefined,
        { timeout: navigationTimeoutMs },
      )
      .catch(() => {});

    const [businessReady] = await Promise.all([
      waitForBusinessReady({
        page,
        scenario,
        timeoutMs: businessTimeoutMs,
      }),
      page.waitForTimeout(waitAfterLoadMs),
    ]);

    const metrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0];
      const resources = performance.getEntriesByType('resource');
      const observerMetrics = globalThis.__onekeyColdStartMetrics || {};
      return {
        navigation: navigation
          ? {
              domContentLoaded:
                navigation.domContentLoadedEventEnd - navigation.startTime,
              load: navigation.loadEventEnd - navigation.startTime,
              transferSize: navigation.transferSize,
              decodedBodySize: navigation.decodedBodySize,
            }
          : null,
        observerMetrics,
        resources: resources.map((entry) => ({
          name: entry.name,
          initiatorType: entry.initiatorType,
          startTime: entry.startTime,
          duration: entry.duration,
          responseEnd: entry.responseEnd,
          transferSize: entry.transferSize,
          encodedBodySize: entry.encodedBodySize,
          decodedBodySize: entry.decodedBodySize,
        })),
        bodyTextLength: document.body?.innerText?.trim()?.length || 0,
        marketPerf: Array.isArray(globalThis.__onekeyMarketPerf)
          ? globalThis.__onekeyMarketPerf
          : [],
        marketReactPerf: Array.isArray(globalThis.__onekeyMarketReactPerf)
          ? globalThis.__onekeyMarketReactPerf
          : [],
      };
    });

    if (enableCpuProfile) {
      const { profile } = await cdp.send('Profiler.stop');
      fs.mkdirSync(profileDir, { recursive: true });
      cpuProfilePath = path.join(
        profileDir,
        `${scenario.name}-run${runIndex}.cpuprofile`,
      );
      fs.writeFileSync(cpuProfilePath, JSON.stringify(profile));
    }

    const rawResources = metrics.resources || [];
    const uniqueResources = dedupeResourceEntries(rawResources);
    const rawScripts = rawResources.filter(
      (entry) =>
        entry.initiatorType === 'script' || /\.m?js($|\?)/.test(entry.name),
    );
    const uniqueScripts = uniqueResources.filter(
      (entry) =>
        entry.initiatorType === 'script' || /\.m?js($|\?)/.test(entry.name),
    );
    const observerMetrics = metrics.observerMetrics || {};
    const longTasks = observerMetrics.longTasks || [];
    const lcp = Number(observerMetrics.largestContentfulPaint);
    const preLcpScripts = rawScripts.filter(
      (entry) => !Number.isFinite(lcp) || entry.startTime <= lcp,
    );
    const largestPreLcpScript = preLcpScripts.reduce(
      (largest, entry) =>
        (entry.decodedBodySize || 0) > (largest?.decodedBodySize || 0)
          ? entry
          : largest,
      null,
    );

    return {
      runIndex,
      scenario: scenario.name,
      url,
      domContentLoaded: metrics.navigation?.domContentLoaded ?? Number.NaN,
      load: metrics.navigation?.load ?? Number.NaN,
      fcp: Number(observerMetrics.firstContentfulPaint),
      lcp,
      firstText: Number(observerMetrics.firstText),
      businessReady: businessReady?.readyAt ?? Number.NaN,
      businessReadyDetails: businessReady,
      marketPerf: metrics.marketPerf || businessReady?.marketPerf || [],
      marketReactPerf: metrics.marketReactPerf || [],
      cpuProfilePath,
      marketListReady:
        scenario.businessReady === 'marketList'
          ? (businessReady?.readyAt ?? Number.NaN)
          : Number.NaN,
      marketListReadyCount:
        scenario.businessReady === 'marketList'
          ? businessReady?.readyCount ||
            businessReady?.domTokenItemCount ||
            (businessReady?.ready ? 1 : 0)
          : 0,
      resourceCount: rawResources.length,
      rawResourceCount: rawResources.length,
      uniqueResourceCount: uniqueResources.length,
      scriptCount: rawScripts.length,
      rawScriptEntryCount: rawScripts.length,
      uniqueScriptCount: uniqueScripts.length,
      totalTransferBytes:
        sum(rawResources.map((entry) => entry.transferSize)) +
        (metrics.navigation?.transferSize || 0),
      totalDecodedBytes:
        sum(rawResources.map((entry) => entry.decodedBodySize)) +
        (metrics.navigation?.decodedBodySize || 0),
      uniqueTotalTransferBytes:
        sum(uniqueResources.map((entry) => entry.transferSize)) +
        (metrics.navigation?.transferSize || 0),
      uniqueTotalDecodedBytes:
        sum(uniqueResources.map((entry) => entry.decodedBodySize)) +
        (metrics.navigation?.decodedBodySize || 0),
      jsTransferBytes: sum(rawScripts.map((entry) => entry.transferSize)),
      jsDecodedBytes: sum(rawScripts.map((entry) => entry.decodedBodySize)),
      uniqueJsTransferBytes: sum(
        uniqueScripts.map((entry) => entry.transferSize),
      ),
      uniqueJsDecodedBytes: sum(
        uniqueScripts.map((entry) => entry.decodedBodySize),
      ),
      longTaskCount: longTasks.length,
      longTaskTotalMs: sum(longTasks.map((entry) => entry.duration)),
      longTaskMaxMs: Math.max(
        0,
        ...longTasks.map((entry) => Number(entry.duration) || 0),
      ),
      longTasks,
      lcpEntries: observerMetrics.largestContentfulPaintEntries || [],
      rendered: (metrics.bodyTextLength || 0) > 0,
      bodyTextLength: metrics.bodyTextLength || 0,
      pageErrorCount: pageErrors.length,
      consoleErrorCount: consoleErrors.length,
      largestPreLcpScriptDecodedBytes:
        largestPreLcpScript?.decodedBodySize || 0,
      largestPreLcpScriptUrl: largestPreLcpScript?.name || null,
      topScripts: rawScripts
        .toSorted((a, b) => (b.decodedBodySize || 0) - (a.decodedBodySize || 0))
        .slice(0, 12)
        .map((entry) => ({
          url: entry.name,
          startTime: entry.startTime,
          decodedBodySize: entry.decodedBodySize,
          transferSize: entry.transferSize,
          duration: entry.duration,
        })),
      scripts: rawScripts.map((entry) => ({
        url: entry.name,
        startTime: entry.startTime,
        decodedBodySize: entry.decodedBodySize,
        transferSize: entry.transferSize,
        duration: entry.duration,
      })),
      uniqueScripts: uniqueScripts.map((entry) => ({
        url: entry.name,
        startTime: entry.startTime,
        decodedBodySize: entry.decodedBodySize,
        transferSize: entry.transferSize,
        duration: entry.duration,
      })),
      rawScripts: rawScripts.map((entry) => ({
        url: entry.name,
        startTime: entry.startTime,
        decodedBodySize: entry.decodedBodySize,
        transferSize: entry.transferSize,
        duration: entry.duration,
      })),
      resources: rawResources.map((entry) => ({
        url: entry.name,
        initiatorType: entry.initiatorType,
        startTime: entry.startTime,
        duration: entry.duration,
        responseEnd: entry.responseEnd,
        decodedBodySize: entry.decodedBodySize,
        transferSize: entry.transferSize,
      })),
      uniqueResources: uniqueResources.map((entry) => ({
        url: entry.name,
        initiatorType: entry.initiatorType,
        startTime: entry.startTime,
        duration: entry.duration,
        responseEnd: entry.responseEnd,
        decodedBodySize: entry.decodedBodySize,
        transferSize: entry.transferSize,
      })),
      rawResources: rawResources.map((entry) => ({
        url: entry.name,
        initiatorType: entry.initiatorType,
        startTime: entry.startTime,
        duration: entry.duration,
        responseEnd: entry.responseEnd,
        decodedBodySize: entry.decodedBodySize,
        transferSize: entry.transferSize,
      })),
      failedRequests,
      badResponses,
      pageErrors,
      consoleErrors,
    };
  } finally {
    await context.close().catch(() => {});
  }
}

function aggregateRuns(runs, initialScripts) {
  const initialScriptRawBytes = sum(
    initialScripts.map((script) => script.bytes),
  );
  return {
    runCount: runs.length,
    domContentLoaded: median(runs.map((run) => run.domContentLoaded)),
    load: median(runs.map((run) => run.load)),
    fcp: median(runs.map((run) => run.fcp)),
    lcp: median(runs.map((run) => run.lcp)),
    firstText: median(runs.map((run) => run.firstText)),
    businessReady: median(runs.map((run) => run.businessReady)),
    marketListReady: median(runs.map((run) => run.marketListReady)),
    marketListReadyRunCount: sum(
      runs.map((run) => (run.marketListReadyCount > 0 ? 1 : 0)),
    ),
    marketListReadyCount: median(runs.map((run) => run.marketListReadyCount)),
    resourceCount: median(runs.map((run) => run.resourceCount)),
    rawResourceCount: median(runs.map((run) => run.rawResourceCount)),
    uniqueResourceCount: median(runs.map((run) => run.uniqueResourceCount)),
    scriptCount: median(runs.map((run) => run.scriptCount)),
    uniqueScriptCount: median(runs.map((run) => run.uniqueScriptCount)),
    rawScriptEntryCount: median(runs.map((run) => run.rawScriptEntryCount)),
    totalTransferBytes: median(runs.map((run) => run.totalTransferBytes)),
    totalDecodedBytes: median(runs.map((run) => run.totalDecodedBytes)),
    uniqueTotalTransferBytes: median(
      runs.map((run) => run.uniqueTotalTransferBytes),
    ),
    uniqueTotalDecodedBytes: median(
      runs.map((run) => run.uniqueTotalDecodedBytes),
    ),
    jsTransferBytes: median(runs.map((run) => run.jsTransferBytes)),
    jsDecodedBytes: median(runs.map((run) => run.jsDecodedBytes)),
    uniqueJsTransferBytes: median(runs.map((run) => run.uniqueJsTransferBytes)),
    uniqueJsDecodedBytes: median(runs.map((run) => run.uniqueJsDecodedBytes)),
    longTaskCount: median(runs.map((run) => run.longTaskCount)),
    longTaskTotalMs: median(runs.map((run) => run.longTaskTotalMs)),
    longTaskMaxMs: median(runs.map((run) => run.longTaskMaxMs)),
    renderedRunCount: sum(runs.map((run) => (run.rendered ? 1 : 0))),
    pageErrorCount: sum(runs.map((run) => run.pageErrorCount)),
    consoleErrorCount: sum(runs.map((run) => run.consoleErrorCount)),
    largestPreLcpScriptDecodedBytes: median(
      runs.map((run) => run.largestPreLcpScriptDecodedBytes),
    ),
    initialScriptRawBytes,
  };
}

function checkRunHealth(summary, scenario) {
  const checks = [
    {
      name: 'rendered',
      pass: summary.renderedRunCount === summary.runCount,
      actual: summary.renderedRunCount,
      expected: summary.runCount,
    },
    {
      name: 'pageErrors',
      pass: summary.pageErrorCount === 0,
      actual: summary.pageErrorCount,
      expected: 0,
    },
  ];
  if (scenario.businessReady === 'marketList') {
    checks.push({
      name: 'marketListReady',
      pass: summary.marketListReadyRunCount === summary.runCount,
      actual: summary.marketListReadyRunCount,
      expected: summary.runCount,
    });
  }
  return checks;
}

function checkBudgets(summary, budgets) {
  const checks = [
    ['fcpMs', summary.fcp],
    ['firstTextMs', summary.firstText],
    ['businessReadyMs', summary.businessReady],
    ['marketListReadyMs', summary.marketListReady],
    ['resourceCount', summary.resourceCount],
    ['scriptCount', summary.scriptCount],
    ['jsDecodedBytes', summary.jsDecodedBytes],
    ['initialScriptRawBytes', summary.initialScriptRawBytes],
    ['longTaskTotalMs', summary.longTaskTotalMs],
    [
      'largestPreLcpScriptDecodedBytes',
      summary.largestPreLcpScriptDecodedBytes,
    ],
  ];
  return checks
    .map(([name, actual]) => {
      const budget = budgets[name];
      const hasRuntimeTolerance =
        RUNTIME_BUDGET_NAMES.has(name) && Number.isFinite(budget);
      const failBudget = hasRuntimeTolerance
        ? budget * (1 + RUNTIME_BUDGET_WARNING_RATIO)
        : budget;
      const withinBudget = Number.isFinite(actual) && actual <= budget;
      const withinFailBudget = Number.isFinite(actual) && actual <= failBudget;
      let status = 'fail';
      if (withinBudget) {
        status = 'pass';
      } else if (withinFailBudget) {
        status = 'warn';
      }
      return {
        name,
        actual,
        budget,
        failBudget,
        toleranceRatio: hasRuntimeTolerance ? RUNTIME_BUDGET_WARNING_RATIO : 0,
        status,
        pass: status !== 'fail',
      };
    })
    .filter((check) => check.budget !== null && check.budget !== undefined);
}

function printReport({
  scenario,
  url,
  summary,
  budgets,
  budgetChecks,
  healthChecks,
  runs,
  initialScripts,
}) {
  const budgetLine = (name, formatValue) => {
    const check = budgetChecks.find((item) => item.name === name);
    const mark =
      check?.status?.toUpperCase() || (check?.pass ? 'PASS' : 'FAIL');
    const toleranceText =
      check?.status !== 'pass' &&
      check?.toleranceRatio &&
      check.failBudget !== check.budget
        ? ` (fail > ${formatValue(check.failBudget)})`
        : '';
    return `${mark} ${name}: ${formatValue(check?.actual)} / ${formatValue(
      check?.budget,
    )}${toleranceText}`;
  };

  // eslint-disable-next-line no-console
  console.log(`\n[perf:web:cold] ${scenario.name} summary`);
  // eslint-disable-next-line no-console
  console.log(`url: ${url}`);
  // eslint-disable-next-line no-console
  console.log(`runs: ${summary.runCount}`);
  // eslint-disable-next-line no-console
  console.log(
    `DCL/load: ${formatMs(summary.domContentLoaded)} / ${formatMs(summary.load)}`,
  );
  // eslint-disable-next-line no-console
  console.log(
    `FCP/LCP/firstText: ${formatMs(summary.fcp)} / ${formatMs(summary.lcp)} / ${formatMs(summary.firstText)}`,
  );
  if (scenario.businessReady) {
    // eslint-disable-next-line no-console
    console.log(`businessReady: ${formatMs(summary.businessReady)}`);
  }
  if (scenario.businessReady === 'marketList') {
    // eslint-disable-next-line no-console
    console.log(
      `marketListReady/count: ${formatMs(summary.marketListReady)} / ${summary.marketListReadyCount}`,
    );
  }
  // eslint-disable-next-line no-console
  console.log(
    `resources/scripts: ${summary.resourceCount} / ${summary.scriptCount}`,
  );
  if (
    summary.uniqueResourceCount !== summary.resourceCount ||
    summary.uniqueScriptCount !== summary.scriptCount
  ) {
    // eslint-disable-next-line no-console
    console.log(
      `unique resources/scripts: ${summary.uniqueResourceCount} / ${summary.uniqueScriptCount}`,
    );
  }
  // eslint-disable-next-line no-console
  console.log(
    `JS decoded/transfer: ${formatBytes(summary.jsDecodedBytes)} / ${formatBytes(summary.jsTransferBytes)}`,
  );
  if (summary.uniqueJsDecodedBytes !== summary.jsDecodedBytes) {
    // eslint-disable-next-line no-console
    console.log(
      `unique JS decoded/transfer: ${formatBytes(summary.uniqueJsDecodedBytes)} / ${formatBytes(summary.uniqueJsTransferBytes)}`,
    );
  }
  // eslint-disable-next-line no-console
  console.log(
    `initial script raw: ${formatBytes(summary.initialScriptRawBytes)}`,
  );
  // eslint-disable-next-line no-console
  console.log(
    `long tasks total/max/count: ${formatMs(summary.longTaskTotalMs)} / ${formatMs(summary.longTaskMaxMs)} / ${summary.longTaskCount}`,
  );
  // eslint-disable-next-line no-console
  console.log(
    `rendered/pageErrors/consoleErrors: ${summary.renderedRunCount}/${summary.runCount} / ${summary.pageErrorCount} / ${summary.consoleErrorCount}`,
  );
  // eslint-disable-next-line no-console
  console.log(
    `largest pre-LCP script: ${formatBytes(
      summary.largestPreLcpScriptDecodedBytes,
    )}`,
  );

  // eslint-disable-next-line no-console
  console.log(`\n[perf:web:cold] ${scenario.name} budgets`);
  const budgetFormatters = {
    fcpMs: formatMs,
    firstTextMs: formatMs,
    businessReadyMs: formatMs,
    marketListReadyMs: formatMs,
    resourceCount: String,
    scriptCount: String,
    jsDecodedBytes: formatBytes,
    initialScriptRawBytes: formatBytes,
    longTaskTotalMs: formatMs,
    largestPreLcpScriptDecodedBytes: formatBytes,
  };
  for (const check of budgetChecks) {
    // eslint-disable-next-line no-console
    console.log(budgetLine(check.name, budgetFormatters[check.name]));
  }

  const topRun =
    runs.find(
      (run) =>
        run.jsDecodedBytes === median(runs.map((item) => item.jsDecodedBytes)),
    ) || runs[0];
  if (topRun?.topScripts?.length) {
    // eslint-disable-next-line no-console
    console.log(
      `\n[perf:web:cold] ${scenario.name} top scripts by decoded size`,
    );
    for (const item of topRun.topScripts.slice(0, 8)) {
      // eslint-disable-next-line no-console
      console.log(
        `${formatBytes(item.decodedBodySize)} ${new URL(item.url).pathname}`,
      );
    }
  }

  if (topRun?.marketPerf?.length) {
    // eslint-disable-next-line no-console
    console.log(`\n[perf:web:cold] ${scenario.name} market perf markers`);
    for (const item of topRun.marketPerf.slice(0, 20)) {
      // eslint-disable-next-line no-console
      console.log(`${formatMs(item.time)} ${item.name}`);
    }
  }

  if (topRun?.marketReactPerf?.length) {
    // eslint-disable-next-line no-console
    console.log(`\n[perf:web:cold] ${scenario.name} market react/commit probe`);
    for (const item of topRun.marketReactPerf.slice(0, 30)) {
      // eslint-disable-next-line no-console
      console.log(
        [
          formatMs(item.time),
          item.phase,
          item.duration !== null && item.duration !== undefined
            ? `+${formatMs(item.duration)}`
            : '',
          item.name,
          item.detail ? JSON.stringify(item.detail) : '',
        ]
          .filter(Boolean)
          .join(' '),
      );
    }
  }

  if (topRun?.cpuProfilePath) {
    // eslint-disable-next-line no-console
    console.log(
      `\n[perf:web:cold] ${scenario.name} cpu profile: ${topRun.cpuProfilePath}`,
    );
  }

  if (topRun?.longTasks?.length) {
    // eslint-disable-next-line no-console
    console.log(`\n[perf:web:cold] ${scenario.name} long tasks`);
    for (const item of topRun.longTasks.slice(0, 20)) {
      // eslint-disable-next-line no-console
      console.log(
        `${formatMs(item.startTime)} +${formatMs(item.duration)} ${item.name || ''}`,
      );
    }
  }

  if (initialScripts.length) {
    // eslint-disable-next-line no-console
    console.log('\n[perf:web:cold] initial scripts by raw file size');
    for (const item of initialScripts
      .toSorted((a, b) => b.bytes - a.bytes)
      .slice(0, 8)) {
      // eslint-disable-next-line no-console
      console.log(`${formatBytes(item.bytes)} ${item.src}`);
    }
  }

  const failures = budgetChecks.filter((check) => !check.pass);
  if (failures.length) {
    // eslint-disable-next-line no-console
    console.log(
      `\n[perf:web:cold] failed budgets: ${failures
        .map((item) => item.name)
        .join(', ')}`,
    );
  }

  const warnings = budgetChecks.filter((check) => check.status === 'warn');
  if (warnings.length) {
    // eslint-disable-next-line no-console
    console.log(
      `\n[perf:web:cold] warning budgets: ${warnings
        .map((item) => item.name)
        .join(', ')}`,
    );
  }

  const healthFailures = healthChecks.filter((check) => !check.pass);
  if (healthFailures.length) {
    // eslint-disable-next-line no-console
    console.log(
      `\n[perf:web:cold] invalid runs: ${healthFailures
        .map((item) => item.name)
        .join(', ')}`,
    );
  }

  // eslint-disable-next-line no-console
  console.log(
    `\n[perf:web:cold] ${scenario.name} output budget target: ${JSON.stringify(
      budgets,
    )}`,
  );
}

async function main() {
  const repoRoot = path.join(__dirname, '..', '..');
  const buildDir =
    process.env.PERF_WEB_BUILD_DIR ||
    path.join(repoRoot, 'apps', 'web', 'web-build');
  const outputPath =
    process.env.PERF_WEB_COLD_OUT ||
    path.join(os.tmpdir(), `onekey-web-cold-${Date.now()}.json`);
  const profileDir =
    process.env.PERF_WEB_COLD_PROFILE_DIR ||
    path.join(os.tmpdir(), `onekey-web-cold-profiles-${Date.now()}`);
  const log = (...args) => {
    // eslint-disable-next-line no-console
    console.log('[perf:web:cold]', ...args);
  };

  await buildWeb({ repoRoot, log });

  if (!fs.existsSync(path.join(buildDir, 'index.html'))) {
    throw new Error(
      `missing build output: ${path.join(buildDir, 'index.html')}`,
    );
  }

  const startupGraphBudgetResult = await checkWebStartupGraphBudget({
    repoRoot,
    buildDir,
    log,
  });
  const startupGraphBudget = startupGraphBudgetResult?.report || null;
  const budgetConfig = loadBudgetConfig(repoRoot);
  const scenarios = parseScenarios();
  const initialScripts = parseInitialScriptFiles(buildDir);
  const staticServer = await startStaticServer({ rootDir: buildDir });
  const executablePath = findChromiumExecutable();
  const browser = await chromium.launch({
    headless: !hasFlag('--headed'),
    executablePath: executablePath || undefined,
    args: [
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-networking',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
    ],
  });

  try {
    const runCount = numberEnv('PERF_RUN_COUNT', 3);
    const scenarioOutputs = [];
    for (const scenario of scenarios) {
      const runs = [];
      const url = scenarioUrl(staticServer.baseUrl, scenario);
      const budgets = getScenarioBudgets(budgetConfig, scenario);
      for (let i = 0; i < runCount; i += 1) {
        runs.push(
          await runOne({
            browser,
            url,
            scenario,
            runIndex: i + 1,
            profileDir,
            waitAfterLoadMs: numberEnv(
              'PERF_WEB_COLD_WAIT_AFTER_LOAD_MS',
              5000,
            ),
            businessTimeoutMs: numberEnv(
              'PERF_WEB_COLD_BUSINESS_TIMEOUT_MS',
              30_000,
            ),
            navigationTimeoutMs: numberEnv(
              'PERF_WEB_COLD_NAVIGATION_TIMEOUT_MS',
              60_000,
            ),
            log,
          }),
        );
      }

      const summary = aggregateRuns(runs, initialScripts);
      const budgetChecks = checkBudgets(summary, budgets);
      const healthChecks = checkRunHealth(summary, scenario);
      const scenarioOutput = {
        name: scenario.name,
        path: scenario.path,
        url,
        budgets,
        budgetChecks,
        healthChecks,
        summary,
        runs,
      };
      scenarioOutputs.push(scenarioOutput);
      printReport({
        scenario,
        url,
        summary,
        budgets,
        budgetChecks,
        healthChecks,
        runs,
        initialScripts,
      });
    }

    const firstScenario = scenarioOutputs[0];
    const legacyTopLevelFieldsNote =
      'Use scenarios[] as the source of truth. Top-level url/budgets/budgetChecks/healthChecks/summary/runs are legacy-compatible fields for the first scenario only.';
    const metricDefinitions = {
      resourceCount:
        'Raw PerformanceResourceTiming resource entry count used by the hard budget gate.',
      rawResourceCount:
        'Alias of resourceCount for compatibility with diagnostic tooling.',
      uniqueResourceCount:
        'Count of distinct normalized resource URLs loaded during the cold-start sample; duplicates from preload + fetch, repeated injection, or cache re-use are collapsed.',
      scriptCount:
        'Raw PerformanceResourceTiming JavaScript resource entry count used by the hard budget gate.',
      uniqueScriptCount:
        'Count of distinct normalized JavaScript resource URLs loaded during the cold-start sample; duplicates are collapsed.',
      rawScriptEntryCount:
        'Alias of scriptCount for compatibility with diagnostic tooling.',
      jsDecodedBytes:
        'Sum of decodedBodySize for raw JavaScript resource entries, matching the existing hard budget baseline.',
      jsTransferBytes:
        'Sum of transferSize for raw JavaScript resource entries.',
      uniqueJsDecodedBytes:
        'Sum of decodedBodySize for distinct normalized JavaScript URLs. When the same URL appears multiple times, the largest decodedBodySize is kept.',
      uniqueJsTransferBytes:
        'Sum of transferSize for distinct normalized JavaScript URLs. When the same URL appears multiple times, the largest transferSize is kept.',
    };
    const output = {
      createdAt: new Date().toISOString(),
      repoRoot,
      buildDir,
      profileDir: booleanEnv('PERF_WEB_COLD_CPU_PROFILE') ? profileDir : null,
      budgetConfig,
      startupGraphBudget,
      legacyTopLevelFieldsNote,
      metricDefinitions,
      scenarios: scenarioOutputs,
      url: firstScenario?.url,
      budgets: firstScenario?.budgets,
      budgetChecks: firstScenario?.budgetChecks,
      healthChecks: firstScenario?.healthChecks,
      summary: firstScenario?.summary,
      initialScripts,
      runs: firstScenario?.runs,
    };
    const aiHints = createWebColdAiHints({
      report: {
        ...output,
        reportPath: outputPath,
      },
      buildDir,
      repoRoot,
    });
    const aiHintsJsonPath =
      process.env.PERF_WEB_COLD_AI_HINTS_JSON_OUT ||
      defaultSiblingPath(outputPath, '-ai-hints.json');
    const aiHintsMarkdownPath =
      process.env.PERF_WEB_COLD_AI_HINTS_MD_OUT ||
      defaultSiblingPath(outputPath, '-ai-hints.md');
    fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
    writeAiHints({
      hints: aiHints,
      jsonPath: aiHintsJsonPath,
      markdownPath: aiHintsMarkdownPath,
    });
    log(`wrote ${outputPath}`);
    log(`wrote ${aiHintsJsonPath}`);
    log(`wrote ${aiHintsMarkdownPath}`);

    const hasBlockingFailure = scenarioOutputs.some(
      (scenarioOutput) =>
        scenarioOutput.healthChecks.some((check) => !check.pass) ||
        scenarioOutput.budgetChecks.some((check) => check.status === 'fail'),
    );
    if (hasBlockingFailure) {
      printAiTriageInstructions({
        artifactName: WEB_BUDGET_ARTIFACT,
        aiHintsJsonPath,
        aiHintsMarkdownPath,
        reportPath: outputPath,
        extraPaths: [
          startupGraphBudgetResult?.aiHintsJsonPath,
          startupGraphBudgetResult?.reportPath,
        ].filter(Boolean),
        notes: [
          legacyTopLevelFieldsNote,
          metricDefinitions.resourceCount,
          metricDefinitions.scriptCount,
          metricDefinitions.jsDecodedBytes,
          metricDefinitions.uniqueScriptCount,
          metricDefinitions.uniqueJsDecodedBytes,
          'Read scenarios[].failedOrWarnBudgetChecks and scenarios[].failedHealthChecks before choosing a fix.',
        ],
        log,
      });
    }

    if (hasBlockingFailure && process.env.PERF_WEB_COLD_BUDGET_FAIL !== '0') {
      process.exitCode = 1;
    }
  } finally {
    await browser.close().catch(() => {});
    await staticServer.close().catch(() => {});
  }
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('[perf:web:cold] failed:', error);
  process.exit(1);
});
