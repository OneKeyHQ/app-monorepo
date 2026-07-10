/* eslint-disable no-console */
/* cspell:words recalc */

import fs from 'node:fs';
import path from 'node:path';

import { chromium } from 'playwright-core';

const CDP_URL = process.env.CDP_URL || 'http://127.0.0.1:9222';
const DEFAULT_OUT_DIR = '.tmp/win-tab-switch-perf';
const POST_READY_MS = 1200;
const READY_TIMEOUT_MS = 15_000;

const TABS = [
  { key: 'market', readyTestIds: ['market-page'] },
  { key: 'swap', readyTestIds: ['swap-content-container'] },
  {
    key: 'perp',
    readyTestIds: [
      'perp-margin-mode-selector',
      'perp-long-button',
      'perp-short-button',
    ],
    readySelectors: ['webview[src*="tradingview.onekey.so"]'],
  },
  {
    key: 'earn',
    readyTestIds: [
      'earn-page',
      'earn-portfolio-overview',
      'earn-market-selector',
    ],
  },
  {
    key: 'referfriends',
    readySelectors: ['[data-testid^="refer-friends-"]'],
  },
  {
    key: 'discovery',
    readyTestIds: [
      'discovery-dashboard-page',
      'sidebar-browser-section',
      'explore-index-search',
      'discovery-trending-section',
    ],
  },
  { key: 'home', readyTestIds: ['home-page'] },
];

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token.startsWith('--')) {
      const key = token.slice(2);
      const value = argv[index + 1];
      if (value === undefined || value.startsWith('--')) {
        args[key] = true;
      } else {
        args[key] = value;
        index += 1;
      }
    }
  }
  return args;
}

function ensureDirectory(directory) {
  fs.mkdirSync(path.resolve(directory), { recursive: true });
}

function metricMap(metrics) {
  return Object.fromEntries(
    metrics.metrics.map(({ name, value }) => [name, value]),
  );
}

function metricDelta(before, after, name) {
  return (after[name] || 0) - (before[name] || 0);
}

function summarizeCpuProfile(profile) {
  const nodesById = new Map(profile.nodes.map((node) => [node.id, node]));
  const selfTimeByFrame = new Map();
  for (let index = 0; index < (profile.samples?.length || 0); index += 1) {
    const node = nodesById.get(profile.samples[index]);
    if (node) {
      const frame = node.callFrame || {};
      let source = '(native)';
      if (frame.url) {
        try {
          const parsed = new URL(frame.url);
          source = parsed.pathname.split('/').slice(-2).join('/');
        } catch {
          source = frame.url.split('/').slice(-2).join('/');
        }
      }
      const key = `${frame.functionName || '(anonymous)'} @ ${source}:${frame.lineNumber ?? '?'}`;
      selfTimeByFrame.set(
        key,
        (selfTimeByFrame.get(key) || 0) + (profile.timeDeltas?.[index] || 0),
      );
    }
  }
  const totalUs = [...selfTimeByFrame.values()].reduce(
    (total, value) => total + value,
    0,
  );
  return [...selfTimeByFrame.entries()]
    .toSorted((left, right) => right[1] - left[1])
    .slice(0, 30)
    .map(([frame, selfUs]) => ({
      frame,
      selfMs: selfUs / 1000,
      share: totalUs ? selfUs / totalUs : 0,
    }));
}

async function readTraceStream(session, stream) {
  const chunks = [];
  while (true) {
    const result = await session.send('IO.read', { handle: stream });
    chunks.push(result.data);
    if (result.eof) {
      break;
    }
  }
  await session.send('IO.close', { handle: stream });
  return chunks.join('');
}

async function startTrace(session) {
  await session.send('Tracing.start', {
    categories: [
      'blink.user_timing',
      'devtools.timeline',
      'disabled-by-default-devtools.timeline',
      'disabled-by-default-devtools.timeline.frame',
      'loading',
      'toplevel',
      'v8',
      'v8.execute',
    ].join(','),
    options: 'sampling-frequency=1000',
    transferMode: 'ReturnAsStream',
  });
}

async function stopTrace(session) {
  const tracingComplete = new Promise((resolve) => {
    session.once('Tracing.tracingComplete', resolve);
  });
  await session.send('Tracing.end');
  const { stream } = await tracingComplete;
  return readTraceStream(session, stream);
}

async function installObservers(page) {
  await page.evaluate(() => {
    globalThis.__onekeyTabPerf = {
      longTasks: [],
      mutation: null,
    };
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          globalThis.__onekeyTabPerf.longTasks.push({
            startTime: entry.startTime,
            duration: entry.duration,
          });
        }
      });
      observer.observe({ entryTypes: ['longtask'] });
      globalThis.__onekeyTabPerf.longTaskObserver = observer;
    } catch {
      // PerformanceObserver long-task entries are unavailable in some builds.
    }
  });
}

async function prepareSwitch(page) {
  return page.evaluate(() => {
    const now = performance.now();
    const sidebar = document.querySelector(
      '[data-testid="Desktop-AppSideBar-Container"]',
    );
    const root = document.querySelector('#root') || document.body;
    globalThis.__onekeyTabPerf.mutation?.observer?.disconnect();
    const mutation = {
      clickStart: now,
      firstContentMutation: null,
      lastContentMutation: null,
      count: 0,
    };
    const observer = new MutationObserver((records) => {
      const hasContentMutation = records.some((record) => {
        const target =
          record.target.nodeType === Node.ELEMENT_NODE
            ? record.target
            : record.target.parentElement;
        return target && !sidebar?.contains(target);
      });
      if (!hasContentMutation) {
        return;
      }
      const mutationTime = performance.now();
      mutation.firstContentMutation ??= mutationTime;
      mutation.lastContentMutation = mutationTime;
      mutation.count += 1;
    });
    observer.observe(root, {
      attributes: true,
      characterData: true,
      childList: true,
      subtree: true,
    });
    mutation.observer = observer;
    globalThis.__onekeyTabPerf.mutation = mutation;
    return now;
  });
}

function isElementVisible(element) {
  if (!element) {
    return false;
  }
  const style = getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  const ancestorsVisible = element.checkVisibility
    ? element.checkVisibility({
        checkOpacity: true,
        checkVisibilityCSS: true,
      })
    : true;
  return (
    ancestorsVisible &&
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    Number(style.opacity || 1) > 0 &&
    rect.width > 0 &&
    rect.height > 0
  );
}

async function waitForTabReady(page, tab) {
  const activeHandle = await page.waitForFunction(
    ({ key }) => {
      const tabElement = document.querySelector(`[data-testid="${key}"]`);
      return tabElement?.querySelector(
        '[data-testid^="tab-modal-active-item-"]',
      )
        ? performance.now()
        : null;
    },
    tab,
    { timeout: READY_TIMEOUT_MS },
  );
  const activeAt = await activeHandle.jsonValue();
  const readyHandle = await page.waitForFunction(
    ({ readySelectors, readyTestIds }) => {
      const visible = (element) => {
        if (!element) {
          return false;
        }
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        const ancestorsVisible = element.checkVisibility
          ? element.checkVisibility({
              checkOpacity: true,
              checkVisibilityCSS: true,
            })
          : true;
        return (
          ancestorsVisible &&
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          Number(style.opacity || 1) > 0 &&
          rect.width > 0 &&
          rect.height > 0 &&
          rect.right > 72 &&
          rect.left < window.innerWidth &&
          rect.bottom > 48 &&
          rect.top < window.innerHeight
        );
      };
      const selectors = [
        ...(readyTestIds || []).map((testId) => `[data-testid="${testId}"]`),
        ...(readySelectors || []),
      ];
      const readySelector = selectors.find((selector) =>
        [...document.querySelectorAll(selector)].some(visible),
      );
      if (!readySelector) {
        return null;
      }
      return {
        readyAt: performance.now(),
        readySelector,
      };
    },
    tab,
    { timeout: READY_TIMEOUT_MS },
  );
  return { activeAt, ...(await readyHandle.jsonValue()) };
}

async function collectSwitchResult({ networkEvents, page, session, tab }) {
  const nav = page.locator(
    `[data-testid="${tab.key}"] > [data-testid^="tab-modal-"]`,
  );
  if ((await nav.count()) !== 1) {
    throw new Error(`Expected exactly one navigation item for ${tab.key}`);
  }
  const navElement = await nav.elementHandle();
  if (!navElement || !(await navElement.evaluate(isElementVisible))) {
    throw new Error(`Navigation item ${tab.key} is not visible`);
  }

  const beforeMetrics = metricMap(await session.send('Performance.getMetrics'));
  const networkStartIndex = networkEvents.length;
  const clickStart = await prepareSwitch(page);
  await nav.click();
  const ready = await waitForTabReady(page, tab);
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      }),
  );
  const paintedAt = await page.evaluate(() => performance.now());
  await page.waitForTimeout(POST_READY_MS);
  const afterMetrics = metricMap(await session.send('Performance.getMetrics'));
  const details = await page.evaluate((startTime) => {
    const mutation = globalThis.__onekeyTabPerf.mutation;
    mutation?.observer?.disconnect();
    const longTasks = (globalThis.__onekeyTabPerf.longTasks || []).filter(
      (entry) => entry.startTime >= startTime,
    );
    return {
      firstContentMutationAt: mutation?.firstContentMutation,
      lastContentMutationAt: mutation?.lastContentMutation,
      mutationCount: mutation?.count || 0,
      longTasks,
    };
  }, clickStart);
  const longTaskTotalMs = details.longTasks.reduce(
    (total, entry) => total + entry.duration,
    0,
  );
  const longTaskMaxMs = details.longTasks.reduce(
    (maximum, entry) => Math.max(maximum, entry.duration),
    0,
  );

  const switchNetworkEvents = networkEvents.slice(networkStartIndex);
  const requestCount = switchNetworkEvents.filter(
    (event) => event.kind === 'request',
  ).length;
  const failedRequestCount = switchNetworkEvents.filter(
    (event) => event.kind === 'failed',
  ).length;

  return {
    tab: tab.key,
    activeMs: ready.activeAt - clickStart,
    readyMs: ready.readyAt - clickStart,
    paintedMs: paintedAt - clickStart,
    firstContentMutationMs:
      details.firstContentMutationAt === null
        ? null
        : details.firstContentMutationAt - clickStart,
    lastContentMutationMs:
      details.lastContentMutationAt === null
        ? null
        : details.lastContentMutationAt - clickStart,
    mutationCount: details.mutationCount,
    longTaskCount: details.longTasks.length,
    longTaskTotalMs,
    longTaskMaxMs,
    readySelector: ready.readySelector,
    requestCount,
    failedRequestCount,
    metrics: {
      taskDurationMs:
        metricDelta(beforeMetrics, afterMetrics, 'TaskDuration') * 1000,
      scriptDurationMs:
        metricDelta(beforeMetrics, afterMetrics, 'ScriptDuration') * 1000,
      layoutDurationMs:
        metricDelta(beforeMetrics, afterMetrics, 'LayoutDuration') * 1000,
      recalcStyleDurationMs:
        metricDelta(beforeMetrics, afterMetrics, 'RecalcStyleDuration') * 1000,
      layoutCount: metricDelta(beforeMetrics, afterMetrics, 'LayoutCount'),
      recalcStyleCount: metricDelta(
        beforeMetrics,
        afterMetrics,
        'RecalcStyleCount',
      ),
      jsHeapUsedDeltaMb:
        metricDelta(beforeMetrics, afterMetrics, 'JSHeapUsedSize') / 1_048_576,
      nodeDelta: metricDelta(beforeMetrics, afterMetrics, 'Nodes'),
    },
  };
}

async function collectPass({
  name,
  networkEvents,
  outDirectory,
  page,
  session,
}) {
  console.error(`Starting ${name} pass`);
  await session.send('Profiler.enable');
  await session.send('Profiler.setSamplingInterval', { interval: 1000 });
  await session.send('Profiler.start');
  await startTrace(session);

  const switches = [];
  for (const tab of TABS) {
    const result = await collectSwitchResult({
      networkEvents,
      page,
      session,
      tab,
    });
    switches.push(result);
    console.error(
      `${name.padEnd(5)} ${tab.key.padEnd(12)} ready=${result.readyMs.toFixed(1)}ms ` +
        `paint=${result.paintedMs.toFixed(1)}ms maxLongTask=${result.longTaskMaxMs.toFixed(1)}ms`,
    );
  }

  const trace = await stopTrace(session);
  const { profile } = await session.send('Profiler.stop');
  const tracePath = path.resolve(outDirectory, `${name}.trace.json`);
  const profilePath = path.resolve(outDirectory, `${name}.cpuprofile`);
  fs.writeFileSync(tracePath, trace);
  fs.writeFileSync(profilePath, JSON.stringify(profile));
  return {
    name,
    switches,
    tracePath,
    profilePath,
    cpuTopSelfTime: summarizeCpuProfile(profile),
  };
}

async function fetchTargets() {
  const response = await fetch(`${CDP_URL}/json`);
  if (!response.ok) {
    throw new Error(`GET ${CDP_URL}/json failed: ${response.status}`);
  }
  const targets = await response.json();
  return targets.map((target) => {
    let origin = '';
    try {
      origin = new URL(target.url).origin;
    } catch {
      // Keep non-URL targets empty so no page content is written to artifacts.
    }
    return {
      type: target.type,
      title:
        target.type === 'page' && target.url === 'file:///' ? 'OneKey' : '',
      origin,
    };
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const outDirectory = path.resolve(args.out || DEFAULT_OUT_DIR);
  const settleSeconds = Number(args.settle || 20);
  ensureDirectory(outDirectory);

  const browser = await chromium.connectOverCDP(CDP_URL);
  const pages = browser.contexts().flatMap((context) => context.pages());
  const page =
    pages.find((candidate) => candidate.url().startsWith('file:')) || pages[0];
  if (!page) {
    throw new Error('No Electron renderer page is exposed over CDP');
  }
  await page.locator('[data-testid="home-page"]').waitFor({
    state: 'visible',
    timeout: READY_TIMEOUT_MS,
  });
  await page.locator('[data-testid="home-total-balance"]').waitFor({
    state: 'visible',
    timeout: READY_TIMEOUT_MS,
  });
  await page.waitForFunction(
    () =>
      document.querySelectorAll(
        '[data-testid="Desktop-AppSideBar-Container"] [data-testid^="tab-modal-"]',
      ).length >= 7,
    undefined,
    { timeout: READY_TIMEOUT_MS },
  );

  const session = await page.context().newCDPSession(page);
  await session.send('Performance.enable');
  await installObservers(page);

  const networkEvents = [];
  page.on('request', (request) => {
    networkEvents.push({
      kind: 'request',
      resourceType: request.resourceType(),
    });
  });
  page.on('requestfailed', (request) => {
    networkEvents.push({
      kind: 'failed',
      resourceType: request.resourceType(),
    });
  });

  const startedAt = new Date().toISOString();
  const cold = await collectPass({
    name: 'cold',
    networkEvents,
    outDirectory,
    page,
    session,
  });
  console.error(`Waiting ${settleSeconds}s before warm pass`);
  await page.waitForTimeout(settleSeconds * 1000);
  const warm = await collectPass({
    name: 'warm',
    networkEvents,
    outDirectory,
    page,
    session,
  });

  const result = {
    startedAt,
    finishedAt: new Date().toISOString(),
    cdpUrl: CDP_URL,
    settleSeconds,
    targets: await fetchTargets(),
    passes: { cold, warm },
  };
  const resultPath = path.resolve(outDirectory, 'results.json');
  fs.writeFileSync(resultPath, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  console.error(`Results written to ${resultPath}`);
  await session.detach().catch(() => {});
  await browser.close();
}

await main();
