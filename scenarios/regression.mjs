#!/usr/bin/env node
/* eslint-disable no-console, onekey/no-raw-error -- standalone Node CLI script, no @onekeyhq/shared dependency */
/* cspell:ignore appstate */
/**
 * scenarios/regression.mjs — unified UI regression series.
 *
 * One runner, many scenarios. Each scenario picks a backend by the platform it
 * targets — the renderer's *detection signal* dictates the backend, never the
 * other way around:
 *   - cdp           Electron desktop / web (Chromium). connectOverCDP gives the
 *                   real signals a freeze repro needs: console errors,
 *                   performance.memory heap, and page.evaluate RTT pings.
 *   - agent-device  iOS / Android RN. No CDP on device; drive via the
 *                   agent-device CLI, detect freeze via command RTT + app logs
 *                   (React's "Maximum update depth" warning lands in RN logs).
 *
 * Usage:
 *   node scenarios/regression.mjs list
 *   node scenarios/regression.mjs dapp-cold-start-desktop --url https://onekey.so
 *   node scenarios/regression.mjs tabs-scroll-extent-desktop # CDP 9222 (yarn app:desktop)
 *   node scenarios/regression.mjs gift-storm-desktop          # CDP 9222 (yarn app:desktop)
 *   node scenarios/regression.mjs gift-storm-web              # CDP 9223 (Chrome --remote-debugging-port=9223 on the web build)
 *   node scenarios/regression.mjs gift-storm-rn --platform ios
 *   node scenarios/regression.mjs gift-storm-rn --platform android
 *
 * Env (shared): ROUNDS, REGRESSION=1 (exit 1 if reproduced, 0 if clean).
 * Env (Tabs): TAB_SWITCH_ROUNDS (default 8).
 * Env (cdp targets): CDP_URL_DESKTOP (falls back to CDP_URL, default 9222),
 *   CDP_URL_WEB (default 9223). Separate names so a desktop CDP_URL override
 *   can't silently redirect the web scenario.
 * Exit codes: 0 reproduced (or REGRESSION clean), 1 REGRESSION fail, 3 not reproduced.
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { chromium } from 'playwright-core';

// ---------------------------------------------------------------------------
// shared helpers
// ---------------------------------------------------------------------------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const hhmmss = () => new Date().toTimeString().slice(0, 8);
const log = (...a) => console.log(`[${hhmmss()}]`, ...a);
const ERR_RE =
  /Maximum update depth|FocusScope|compose-refs|too many re-renders/i;

function parseFlags(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        flags[key] = next;
        i += 1;
      } else {
        flags[key] = true;
      }
    }
  }
  return flags;
}

const ROUNDS = Number(process.env.ROUNDS || 80);
const REGRESSION = process.env.REGRESSION === '1';

function report(name, hits, ran, frozeAt, errTotal, firstErr) {
  console.log('\n===== RESULT =====');
  console.log(
    `[${name}] hits ${hits}/${ran}${
      frozeAt ? ` (froze at round ${frozeAt})` : ''
    } | matched errors=${errTotal}`,
  );
  if (firstErr) console.log(`first error: ${firstErr}`);
  const reproduced = hits > 0;
  console.log(
    reproduced
      ? `🔴 REPRODUCED (hit rate ${Math.round((hits / ran) * 100)}%)`
      : '🟢 not reproduced this run',
  );
  if (REGRESSION) {
    console.log(reproduced ? 'REGRESSION FAIL ❌' : 'REGRESSION PASS ✅');
    return reproduced ? 1 : 0;
  }
  return reproduced ? 0 : 3;
}

// ===========================================================================
// CDP backend — Electron desktop (9222) and web (9223). Same Chromium renderer.
// ===========================================================================
async function connectCdpMainWindow(cdpUrl) {
  let browser;
  try {
    browser = await chromium.connectOverCDP(cdpUrl);
  } catch (e) {
    throw new Error(
      `CDP connect failed at ${cdpUrl}. Desktop: run "yarn app:desktop" (port 9222). ` +
        `Web: launch Chrome with --remote-debugging-port=9223 on the "yarn app:web" URL.\n${
          e.message || e
        }`,
      { cause: e },
    );
  }
  let page = null;
  await waitForCondition(
    'OneKey main window on CDP',
    async () => {
      for (const c of browser.contexts()) {
        for (const p of c.pages()) {
          try {
            if ((await p.locator('[data-testid^="tab-modal"]').count()) > 0) {
              page = p;
              return true;
            }
          } catch {
            /* page may be navigating */
          }
        }
      }
      return false;
    },
    30_000,
  );
  if (!page) {
    // Detach only — never browser.close(), it would kill the user's running app
    // (see references/rules/electron-cdp.md). connectOverCDP leaks no process.
    throw new Error('OneKey main window not found on CDP (no tab-modal root)');
  }
  return { browser, page };
}

function normalizeHost(value) {
  try {
    const normalizedUrl = /^https?:\/\//i.test(value)
      ? value
      : `https://${value}`;
    return new URL(normalizedUrl).hostname.replace(/^www\./i, '');
  } catch {
    return '';
  }
}

function urlMatchesHost(value, expectedHost) {
  const actualHost = normalizeHost(value);
  if (!actualHost || !expectedHost) return false;
  return actualHost === expectedHost || actualHost.endsWith(`.${expectedHost}`);
}

async function waitForCondition(label, predicate, timeoutMs = 30_000) {
  const startedAt = Date.now();
  let lastError = null;
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const result = await predicate();
      if (result) return result;
    } catch (error) {
      lastError = error;
    }
    await sleep(500);
  }
  throw new Error(
    `${label} timed out after ${timeoutMs}ms${
      lastError?.message ? `: ${lastError.message}` : ''
    }`,
  );
}

async function getVisibleInputValues(page, testId) {
  const inputs = await page.locator(`[data-testid="${testId}"]`).all();
  const values = [];
  for (const input of inputs) {
    const isVisible = await input.isVisible().catch(() => false);
    if (isVisible) {
      const value = await input.inputValue().catch(async () => {
        return input.textContent().catch(() => '');
      });
      values.push(value ?? '');
    }
  }
  return values;
}

async function firstVisibleLocator(page, testIds) {
  for (const testId of testIds) {
    const locator = page.locator(`[data-testid="${testId}"]`).first();
    if (await locator.isVisible().catch(() => false)) {
      return locator;
    }
  }
  return null;
}

async function firstVisibleSelector(page, selectors) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if (await locator.isVisible().catch(() => false)) {
      return locator;
    }
  }
  return null;
}

async function replaceText(locator, page, text) {
  await locator.click({ force: true, timeout: 5000 });
  await locator.fill(text).catch(async () => {
    await page.keyboard.press(
      process.platform === 'darwin' ? 'Meta+A' : 'Control+A',
    );
    await page.keyboard.type(text);
  });
}

async function readDesktopWebviewStates(page) {
  const handles = await page.locator('webview').elementHandles();
  return Promise.all(
    handles.map((handle) =>
      handle
        .evaluate(async (element) => {
          let pageInfo = null;
          let pageInfoError = '';
          if (typeof element.executeJavaScript === 'function') {
            try {
              pageInfo = await element.executeJavaScript(`
                (() => {
                  const visibleText = (
                    document.body?.innerText ||
                    document.documentElement?.innerText ||
                    ''
                  ).replace(/\\s+/g, ' ').trim();
                  return {
                    href: window.location.href,
                    readyState: document.readyState,
                    textLength: visibleText.length,
                    title: document.title || ''
                  };
                })()
              `);
            } catch (error) {
              pageInfoError =
                error instanceof Error ? error.message : String(error);
            }
          }

          return {
            loading:
              typeof element.isLoading === 'function'
                ? element.isLoading()
                : undefined,
            pageInfo,
            pageInfoError,
            src: element.getAttribute('src') || '',
            title:
              typeof element.getTitle === 'function' ? element.getTitle() : '',
            url: typeof element.getURL === 'function' ? element.getURL() : '',
          };
        })
        .catch((error) => ({
          pageInfo: null,
          pageInfoError: error?.message || String(error),
          src: '',
          title: '',
          url: '',
        })),
    ),
  );
}

function webviewStateHref(state) {
  return state.pageInfo?.href || state.url || state.src || '';
}

function hasRenderedWebviewContent(state) {
  if (!state.pageInfo) {
    return false;
  }
  const readyState = state.pageInfo?.readyState || '';
  const textLength = Number(state.pageInfo?.textLength || 0);
  const title = state.pageInfo?.title || '';
  return readyState !== 'loading' && (title.length > 0 || textLength > 0);
}

function compactWebviewState(state) {
  return {
    href: webviewStateHref(state),
    title: state.pageInfo?.title || state.title || '',
    readyState: state.pageInfo?.readyState || '',
    textLength: Number(state.pageInfo?.textLength || 0),
    pageInfoError: state.pageInfoError || '',
    src: state.src || '',
    url: state.url || '',
  };
}

function textMentionsHost(value, expectedHost) {
  return String(value || '')
    .toLowerCase()
    .includes(String(expectedHost || '').toLowerCase());
}

async function findDappSearchResult(page, expectedHost) {
  const directResult = page.locator('[data-testid="dapp-search0"]').first();
  if (await directResult.isVisible().catch(() => false)) {
    return directResult;
  }

  const modalItems = await page.locator('[data-testid^="search-modal-"]').all();
  for (const item of modalItems) {
    if (await item.isVisible().catch(() => false)) {
      const marker = await item
        .evaluate(
          (element) =>
            `${element.getAttribute('data-testid') || ''} ${
              element.textContent || ''
            }`,
        )
        .catch(() => '');
      if (textMentionsHost(marker, expectedHost)) {
        return item;
      }
    }
  }

  return null;
}

function desktopBrowserShortcutKey() {
  return process.platform === 'darwin' ? 'Meta+7' : 'Control+7';
}

async function findBrowserHomeSearchInput(page) {
  return firstVisibleSelector(page, [
    'input[data-testid="search-input"]',
    '[data-testid="search-input"] input',
    'textarea[data-testid="search-input"]',
    'input[placeholder*="Search dApps"]',
    'input[placeholder*="enter URL"]',
  ]);
}

async function submitBrowserHomeSearch(page, targetUrl) {
  const searchInput = await waitForCondition(
    'desktop browser home search input',
    () => findBrowserHomeSearchInput(page),
    15_000,
  );
  await replaceText(searchInput, page, targetUrl);

  const directUrlResult = await waitForCondition(
    'desktop browser direct URL result',
    () => firstVisibleSelector(page, ['[data-testid="dapp-search0"]']),
    5000,
  ).catch(() => null);
  if (directUrlResult) {
    await directUrlResult.click({ force: true, timeout: 5000 });
  } else {
    await page.keyboard.press('Enter');
  }
}

async function openDappViaDesktopBrowserShortcut(page, targetUrl) {
  await page
    .locator('[data-testid="Desktop-AppSideBar-Container"]')
    .first()
    .waitFor({ state: 'visible', timeout: 10_000 });
  await page.keyboard.press(desktopBrowserShortcutKey());
  await submitBrowserHomeSearch(page, targetUrl);
  return 'browser-shortcut-search-input';
}

function reportVerification(name, checks) {
  const failed = checks.filter((check) => !check.pass);
  console.log('\n===== RESULT =====');
  for (const check of checks) {
    console.log(
      `[${name}] ${check.pass ? 'PASS' : 'FAIL'} ${check.name}${
        check.detail ? ` | ${check.detail}` : ''
      }`,
    );
  }
  if (failed.length > 0) {
    console.log(`${name}: ${failed.length} failed check(s)`);
    return REGRESSION ? 1 : 3;
  }
  console.log(`${name}: all checks passed`);
  return 0;
}

async function openDappFromDesktopUi(page, targetUrl, expectedHost) {
  const shortcutMethod = await openDappViaDesktopBrowserShortcut(
    page,
    targetUrl,
  ).catch((error) => {
    log(`browser shortcut path unavailable: ${error?.message || error}`);
    return '';
  });
  if (shortcutMethod) {
    return shortcutMethod;
  }

  const browserAddButton = page
    .locator('[data-testid="browser-bar-add"]')
    .first();
  if (await browserAddButton.isVisible().catch(() => false)) {
    await browserAddButton.click({ force: true, timeout: 10_000 });
    const input = page
      .locator('[data-testid="explore-index-search-input"]')
      .last();
    await input.waitFor({ state: 'visible', timeout: 10_000 });
    await replaceText(input, page, targetUrl);
    await page.keyboard.press('Enter');
    return 'browser-sidebar';
  }

  if (
    !(await page
      .locator('[data-testid="nav-header-search-universal-search-search-bar"]')
      .first()
      .isVisible()
      .catch(() => false))
  ) {
    await page
      .locator('[data-testid="nav-header-search"]')
      .first()
      .click({ force: true, timeout: 10_000 });
  }

  const searchInput = await waitForCondition(
    'desktop global search input',
    () =>
      firstVisibleLocator(page, [
        'nav-header-search-universal-search-search-bar',
        'discovery-search-input',
        'explore-index-search',
      ]),
    10_000,
  );
  await replaceText(searchInput, page, targetUrl);
  const searchResult = await waitForCondition(
    'desktop global DApp search result',
    () => findDappSearchResult(page, expectedHost),
    5000,
  ).catch(() => null);
  if (searchResult) {
    await searchResult.click({ force: true, timeout: 5000 });
  } else {
    await page.keyboard.press('Enter');
  }
  return 'global-search';
}

async function runDappColdStartDesktop(cdpUrl, flags) {
  const targetUrl = String(
    flags.url || process.env.DAPP_URL || 'https://onekey.so',
  );
  const expectedHost = normalizeHost(targetUrl);
  if (!expectedHost) {
    throw new Error(`Invalid DApp URL: ${targetUrl}`);
  }

  const { browser, page } = await connectCdpMainWindow(cdpUrl);
  const browserTabs = page.locator(
    '[data-testid^="tab-list-stack-"], [data-testid^="tab-list-stack-pinned-"]',
  );
  const beforeTabCount = await browserTabs.count().catch(() => 0);
  const consoleErrors = [];
  const attachedErrorPages = new WeakSet();
  const collectError = (source, text) => {
    const message = String(text || '')
      .split('\n')[0]
      .slice(0, 240);
    if (message) {
      consoleErrors.push(`${source}: ${message}`);
    }
  };
  const attachErrorListeners = (targetPage, source) => {
    if (!targetPage || attachedErrorPages.has(targetPage)) return;
    attachedErrorPages.add(targetPage);
    targetPage.on('console', (message) => {
      if (message.type() === 'error') collectError(source, message.text());
    });
    targetPage.on('pageerror', (error) =>
      collectError(source, error.message || String(error)),
    );
  };
  const captureOutcome = async (label, action) => {
    try {
      return { pass: true, value: await action(), detail: '' };
    } catch (error) {
      return {
        pass: false,
        value: null,
        detail: `${label}: ${error?.message || String(error)}`,
      };
    }
  };

  attachErrorListeners(page, 'main');
  for (const context of browser.contexts()) {
    context.on('page', (candidate) => {
      if (candidate !== page) attachErrorListeners(candidate, 'webview');
    });
  }

  log(`opening DApp URL ${targetUrl}`);
  const openOutcome = await captureOutcome('open DApp from desktop UI', () =>
    openDappFromDesktopUi(page, targetUrl, expectedHost),
  );
  const openMethod = openOutcome.value || 'unavailable';

  const tabCreated = await captureOutcome('browser tab creation', () =>
    waitForCondition('browser tab creation', async () => {
      const count = await browserTabs.count().catch(() => 0);
      return count > beforeTabCount ? count : 0;
    }),
  );

  const activeInputValues = await captureOutcome('active browser URL bar', () =>
    waitForCondition(
      'active browser URL bar',
      async () => {
        const values = await getVisibleInputValues(
          page,
          'explore-index-search-input',
        );
        return values.some((value) => urlMatchesHost(value, expectedHost))
          ? values
          : null;
      },
      20_000,
    ),
  );

  const webviewSnapshot = await captureOutcome(
    'webview element readiness',
    () =>
      waitForCondition(
        'webview element readiness',
        async () => {
          const states = await readDesktopWebviewStates(page);
          const match = states.find((state) =>
            urlMatchesHost(webviewStateHref(state), expectedHost),
          );
          return match && hasRenderedWebviewContent(match)
            ? compactWebviewState(match)
            : null;
        },
        35_000,
      ),
  );

  const checks = [
    {
      name: 'DApp navigation was initiated from desktop UI',
      pass: openOutcome.pass,
      detail: openOutcome.pass ? openMethod : openOutcome.detail,
    },
    {
      name: 'browser tab was created',
      pass: tabCreated.pass && tabCreated.value > beforeTabCount,
      detail: tabCreated.pass
        ? `${beforeTabCount} -> ${tabCreated.value} via ${openMethod}`
        : tabCreated.detail,
    },
    {
      name: 'active URL bar points at target host',
      pass:
        activeInputValues.pass &&
        activeInputValues.value.some((value) =>
          urlMatchesHost(value, expectedHost),
        ),
      detail: activeInputValues.pass
        ? activeInputValues.value.join(', ')
        : activeInputValues.detail,
    },
    {
      name: 'Electron webview element loaded target host',
      pass:
        webviewSnapshot.pass &&
        urlMatchesHost(webviewSnapshot.value.href, expectedHost),
      detail: webviewSnapshot.pass
        ? webviewSnapshot.value.href
        : webviewSnapshot.detail,
    },
    {
      name: 'webview document has rendered content',
      pass:
        webviewSnapshot.pass &&
        (webviewSnapshot.value.title.length > 0 ||
          webviewSnapshot.value.textLength > 0),
      detail: webviewSnapshot.pass
        ? `title="${webviewSnapshot.value.title}" textLength=${webviewSnapshot.value.textLength}`
        : webviewSnapshot.detail,
    },
    {
      name: 'main renderer and webview probe have no captured DApp errors',
      pass:
        consoleErrors.length === 0 &&
        (!webviewSnapshot.pass || !webviewSnapshot.value.pageInfoError),
      detail: [
        ...consoleErrors.slice(0, 3),
        webviewSnapshot.pass && webviewSnapshot.value.pageInfoError
          ? `webview: ${webviewSnapshot.value.pageInfoError}`
          : '',
      ]
        .filter(Boolean)
        .join(' | '),
    },
  ];

  return reportVerification('dapp-cold-start-desktop', checks);
}

async function runTabsScrollExtentDesktop(cdpUrl) {
  const { page } = await connectCdpMainWindow(cdpUrl);
  const growthProbeTestId = 'tabs-scroll-extent-late-growth-probe';
  const headerProbeTestId = 'tabs-scroll-extent-header-probe';
  const tabSwitchRounds = Number(process.env.TAB_SWITCH_ROUNDS || 8);
  const visiblePasswordInput = page.locator(
    '[data-testid="password-input"]:visible',
  );
  if ((await visiblePasswordInput.count()) > 0) {
    throw new Error(
      'Desktop app is locked. Unlock it before running the Tabs scroll extent scenario.',
    );
  }

  const defiTab = page.locator('[data-testid="home-tab-defi"]');
  const nftTab = page.locator('[data-testid="home-tab-nft"]');
  await defiTab.waitFor({ state: 'visible', timeout: 15_000 });
  await nftTab.waitFor({ state: 'visible', timeout: 15_000 });

  // The dev shell starts on Portfolio, whereas QA can reopen with DeFi still
  // selected. Enter DeFi at most once and do not leave/re-enter while its slow
  // data resolves: a round trip would re-attach the old observer and mask the
  // cold-start failure this first phase is meant to catch.
  await defiTab.click({ force: true });

  const defiContent = page
    .locator('[data-testid="home-defi-tab-content"]:visible')
    .first();
  await defiContent.waitFor({ state: 'visible', timeout: 30_000 });
  await waitForCondition(
    'scrollable Tabs.ScrollView content',
    () =>
      defiContent.evaluate((tabContent) => {
        if (!(tabContent instanceof HTMLElement)) return false;
        const scrollViewRoot = tabContent.closest('.onekey-tabs-scroll-view');
        const scroller = scrollViewRoot?.closest('.onekey-tabs-container');
        return (
          scrollViewRoot instanceof HTMLElement &&
          scroller instanceof HTMLElement &&
          scrollViewRoot.scrollHeight > window.innerHeight
        );
      }),
    45_000,
  );

  // Use DeFi as a real, long Tabs.ScrollView fixture, then inject a
  // deterministic late-growing block after the tab has settled. This models
  // any tab child (image, list section, banner) resolving asynchronously.
  // A correct Tabs implementation expands the shared scroll extent without
  // requiring the business tab to report its own height.
  await sleep(1200);
  const getMetrics = () =>
    defiContent.evaluate((tabContent) => {
      if (!(tabContent instanceof HTMLElement)) return null;
      const scrollViewRoot = tabContent.closest('.onekey-tabs-scroll-view');
      const scroller = scrollViewRoot?.closest('.onekey-tabs-container');
      if (
        !(scrollViewRoot instanceof HTMLElement) ||
        !(scroller instanceof HTMLElement) ||
        !scroller.contains(tabContent)
      ) {
        return null;
      }
      // WindowScroller adds wrapper nodes between the registered ScrollView
      // and the shared horizontal list container. The latter is the nearest
      // ancestor with an imperative inline height; asserting that height
      // changes prevents overflow from masking a stale Tabs measurement.
      let listContainer = scrollViewRoot.parentElement;
      while (
        listContainer &&
        listContainer !== scroller &&
        !listContainer.style.height
      ) {
        listContainer = listContainer.parentElement;
      }
      if (listContainer === scroller) {
        listContainer = null;
      }
      const scrollerRect = scroller.getBoundingClientRect();
      const contentRect = tabContent.getBoundingClientRect();
      const maxScrollTop = scroller.scrollHeight - scroller.clientHeight;
      return {
        atBottom: Math.abs(scroller.scrollTop - maxScrollTop) <= 2,
        clientHeight: scroller.clientHeight,
        contentHeight: contentRect.height,
        contentScrollHeight: tabContent.scrollHeight,
        hiddenBelowScroller: Math.max(
          0,
          contentRect.bottom - scrollerRect.bottom,
        ),
        listContainerHeight:
          listContainer instanceof HTMLElement
            ? listContainer.getBoundingClientRect().height
            : 0,
        maxScrollTop,
        scrollViewHeight: scrollViewRoot.getBoundingClientRect().height,
        scrollViewScrollHeight: scrollViewRoot.scrollHeight,
        unmeasuredScrollViewOverflow:
          listContainer instanceof HTMLElement
            ? Math.max(
                0,
                scrollViewRoot.scrollHeight -
                  listContainer.getBoundingClientRect().height,
              )
            : 0,
        scrollHeight: scroller.scrollHeight,
        scrollTop: scroller.scrollTop,
        viewportHeight: window.innerHeight,
        viewportWidth: window.innerWidth,
      };
    });

  const wheelToBottom = async () => {
    const scrollTarget = await defiContent.evaluate((tabContent) => {
      if (!(tabContent instanceof HTMLElement)) return null;
      const scroller = tabContent
        .closest('.onekey-tabs-scroll-view')
        ?.closest('.onekey-tabs-container');
      if (!(scroller instanceof HTMLElement)) return null;
      const rect = scroller.getBoundingClientRect();
      return {
        x: rect.left + rect.width / 2,
        y: Math.max(rect.top + 1, rect.bottom - 100),
      };
    });
    if (!scrollTarget) {
      throw new Error('Tabs wheel target is unavailable');
    }
    // Keep the pointer over real tab content. Leaving it on the sticky tab
    // button bypasses Chromium's stale hit-test extent and masks this bug.
    await page.mouse.move(scrollTarget.x, scrollTarget.y);
    let previousScrollTop = -1;
    let settledRounds = 0;
    for (let round = 0; round < 30 && settledRounds < 3; round += 1) {
      await page.mouse.wheel(0, 1200);
      await sleep(80);
      const metrics = await getMetrics();
      if (!metrics) throw new Error('Tabs scroll metrics are unavailable');
      if (Math.abs(metrics.scrollTop - previousScrollTop) <= 0.5) {
        settledRounds += 1;
      } else {
        settledRounds = 0;
      }
      previousScrollTop = metrics.scrollTop;
    }
  };

  // Closing a wallet banner shrinks renderHeader without changing the focused
  // tab's own content height. Reproduce that structural change with a
  // deterministic header child, then verify the current tab accepts real wheel
  // input immediately; switching tabs must not be required to recover it.
  const cleanupHeaderProbe = () =>
    defiContent.evaluate((tabContent, testId) => {
      if (!(tabContent instanceof HTMLElement)) return;
      const scroller = tabContent
        .closest('.onekey-tabs-scroll-view')
        ?.closest('.onekey-tabs-container');
      if (scroller instanceof HTMLElement) {
        scroller.querySelector(`[data-testid="${testId}"]`)?.remove();
      }
    }, headerProbeTestId);
  const cleanupHeaderRefreshObserver = () =>
    defiContent.evaluate((tabContent) => {
      if (!(tabContent instanceof HTMLElement)) return;
      const scroller = tabContent
        .closest('.onekey-tabs-scroll-view')
        ?.closest('.onekey-tabs-container');
      if (!(scroller instanceof HTMLElement)) return;
      scroller.__tabsHeaderRefreshObserver?.disconnect();
      delete scroller.__tabsHeaderRefreshObserver;
      delete scroller.dataset.tabsHeaderRefreshObserved;
    });

  await cleanupHeaderProbe();
  await cleanupHeaderRefreshObserver();
  let headerShrinkFailure = false;
  try {
    const insertedHeaderProbe = await defiContent.evaluate(
      (tabContent, testId) => {
        if (!(tabContent instanceof HTMLElement)) return false;
        const scroller = tabContent
          .closest('.onekey-tabs-scroll-view')
          ?.closest('.onekey-tabs-container');
        const header = scroller?.firstElementChild;
        if (
          !(scroller instanceof HTMLElement) ||
          !(header instanceof HTMLElement)
        ) {
          return false;
        }
        const scrollViewRoot = tabContent.closest('.onekey-tabs-scroll-view');
        let listContainer = scrollViewRoot?.parentElement;
        while (
          listContainer &&
          listContainer !== scroller &&
          !listContainer.style.height
        ) {
          listContainer = listContainer.parentElement;
        }
        if (
          !(listContainer instanceof HTMLElement) ||
          listContainer === scroller
        ) {
          return false;
        }
        scroller.dataset.tabsHeaderRefreshObserved = 'false';
        const refreshObserver = new MutationObserver((records) => {
          if (
            records.some((record) => record.oldValue?.includes('display: none'))
          ) {
            scroller.dataset.tabsHeaderRefreshObserved = 'true';
          }
        });
        refreshObserver.observe(listContainer, {
          attributeFilter: ['style'],
          attributeOldValue: true,
          attributes: true,
        });
        scroller.__tabsHeaderRefreshObserver = refreshObserver;
        scroller.scrollTop = 0;
        const probe = document.createElement('div');
        probe.setAttribute('data-testid', testId);
        probe.style.cssText =
          'display:block;flex:none;width:100%;height:96px;min-height:96px;';
        header.append(probe);
        return true;
      },
      headerProbeTestId,
    );
    if (!insertedHeaderProbe) {
      throw new Error('Could not insert the Tabs header probe');
    }
    await sleep(300);
    await cleanupHeaderProbe();
    await sleep(300);

    await wheelToBottom();
    await sleep(300);

    const headerShrinkMetrics = await getMetrics();
    if (!headerShrinkMetrics) {
      throw new Error(
        'Tabs scroll metrics are unavailable after header shrink',
      );
    }
    const headerRefreshObserved = await defiContent.evaluate((tabContent) => {
      if (!(tabContent instanceof HTMLElement)) return false;
      const scroller = tabContent
        .closest('.onekey-tabs-scroll-view')
        ?.closest('.onekey-tabs-container');
      return (
        scroller instanceof HTMLElement &&
        scroller.dataset.tabsHeaderRefreshObserved === 'true'
      );
    });
    headerShrinkFailure =
      !headerRefreshObserved ||
      !headerShrinkMetrics.atBottom ||
      headerShrinkMetrics.hiddenBelowScroller > 2 ||
      headerShrinkMetrics.unmeasuredScrollViewOverflow > 2;
    log(
      `Header shrink wheel: ${
        headerShrinkFailure ? 'stuck' : 'clean'
      } refresh=${headerRefreshObserved} scrollTop=${headerShrinkMetrics.scrollTop.toFixed(
        1,
      )}/${headerShrinkMetrics.maxScrollTop.toFixed(1)}`,
    );
  } finally {
    await cleanupHeaderProbe();
    await cleanupHeaderRefreshObserver();
  }

  if (headerShrinkFailure) {
    const screenshotPath = path.resolve(
      '.tmp/ui/tabs-scroll-extent-header-shrink-desktop.png',
    );
    fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
    await page.screenshot({ path: screenshotPath });
    log(`evidence -> ${screenshotPath}`);
    return report('tabs-scroll-extent-desktop', 1, 1, 0, 0, '');
  }

  // Reproduce OK-57257's recorded sequence first: a fully rendered, tall DeFi
  // tab is scrolled away from the top, switched to the short NFT tab, restored,
  // and then driven to the bottom with real wheel events. Repeat it because the
  // original bug was timing-sensitive.
  await wheelToBottom();
  const initialDefiMetrics = await getMetrics();
  if (!initialDefiMetrics?.atBottom) {
    throw new Error('Could not establish the initial DeFi scroll bottom');
  }
  const coldStartClipped =
    initialDefiMetrics.hiddenBelowScroller > 2 ||
    initialDefiMetrics.unmeasuredScrollViewOverflow > 2;
  log(
    `DeFi initial load before tab round trip: ${
      coldStartClipped ? 'clipped' : 'clean'
    } scrollTop=${initialDefiMetrics.scrollTop.toFixed(
      1,
    )}/${initialDefiMetrics.maxScrollTop.toFixed(
      1,
    )} container=${initialDefiMetrics.listContainerHeight.toFixed(
      1,
    )} scrollView=${initialDefiMetrics.scrollViewHeight.toFixed(
      1,
    )}/${initialDefiMetrics.scrollViewScrollHeight}px hidden=${initialDefiMetrics.hiddenBelowScroller.toFixed(
      1,
    )}px unmeasured=${initialDefiMetrics.unmeasuredScrollViewOverflow.toFixed(
      1,
    )}px`,
  );

  let tabRoundTripFailures = 0;
  for (let round = 1; round <= tabSwitchRounds; round += 1) {
    // The issue video switches tabs while DeFi is part-way down the page and
    // the sticky tab selector is visible, rather than from the page top.
    await page.mouse.wheel(0, -2400);
    await sleep(120);
    await nftTab.click({ force: true });
    await sleep(300);
    await defiTab.click({ force: true });
    await sleep(500);
    await wheelToBottom();

    const roundMetrics = await getMetrics();
    if (!roundMetrics) throw new Error('Tabs scroll metrics are unavailable');
    const clipped =
      !roundMetrics.atBottom ||
      roundMetrics.hiddenBelowScroller > 2 ||
      roundMetrics.listContainerHeight <
        initialDefiMetrics.listContainerHeight - 2;
    if (clipped) tabRoundTripFailures += 1;
    log(
      `DeFi->NFT->DeFi round ${round}/${tabSwitchRounds}: ${
        clipped ? 'clipped' : 'clean'
      } scrollTop=${roundMetrics.scrollTop.toFixed(
        1,
      )}/${roundMetrics.maxScrollTop.toFixed(
        1,
      )} container=${roundMetrics.listContainerHeight.toFixed(
        1,
      )} content=${roundMetrics.contentScrollHeight}px hidden=${roundMetrics.hiddenBelowScroller.toFixed(
        1,
      )}px`,
    );
  }

  // Then establish the old compositor extent at the current bottom and grow
  // the content, matching the related failure where slow data expands a tab
  // after the user has already reached its initially shorter bottom.
  await wheelToBottom();
  const beforeGrowthMetrics = await getMetrics();
  if (!beforeGrowthMetrics?.atBottom) {
    throw new Error('Could not establish the Tabs pre-growth scroll bottom');
  }

  const cleanupGrowthProbe = () =>
    defiContent.evaluate((tabContent, testId) => {
      if (!(tabContent instanceof HTMLElement)) return;
      const scrollViewRoot = tabContent.closest('.onekey-tabs-scroll-view');
      if (scrollViewRoot instanceof HTMLElement) {
        const probe = scrollViewRoot.querySelector(`[data-testid="${testId}"]`);
        probe?.remove();
        const snapshot = JSON.parse(
          scrollViewRoot.dataset.tabsScrollExtentOriginalStyle ?? '[]',
        );
        for (const [property, value, priority] of snapshot) {
          if (value) {
            scrollViewRoot.style.setProperty(property, value, priority);
          } else {
            scrollViewRoot.style.removeProperty(property);
          }
        }
        delete scrollViewRoot.dataset.tabsScrollExtentOriginalStyle;
      }
    }, growthProbeTestId);

  await cleanupGrowthProbe();
  try {
    const insertedGrowthProbe = await defiContent.evaluate(
      (tabContent, testId) => {
        if (!(tabContent instanceof HTMLElement)) return false;
        const scrollViewRoot = tabContent.closest('.onekey-tabs-scroll-view');
        const scroller = scrollViewRoot?.closest('.onekey-tabs-container');
        if (
          !(scrollViewRoot instanceof HTMLElement) ||
          !(scroller instanceof HTMLElement)
        ) {
          return false;
        }
        const properties = ['height', 'min-height', 'max-height', 'flex'];
        scrollViewRoot.dataset.tabsScrollExtentOriginalStyle = JSON.stringify(
          properties.map((property) => [
            property,
            scrollViewRoot.style.getPropertyValue(property),
            scrollViewRoot.style.getPropertyPriority(property),
          ]),
        );
        const lockedHeight = scrollViewRoot.getBoundingClientRect().height;
        scrollViewRoot.style.setProperty('height', `${lockedHeight}px`);
        scrollViewRoot.style.setProperty('min-height', `${lockedHeight}px`);
        scrollViewRoot.style.setProperty('max-height', `${lockedHeight}px`);
        scrollViewRoot.style.setProperty('flex', 'none');
        const probe = document.createElement('div');
        probe.setAttribute('data-testid', testId);
        probe.style.cssText =
          'display:block;flex:none;width:100%;height:96px;min-height:96px;';
        // Add a new direct content node. The previous implementation observed a
        // one-time child snapshot, so a cold-start skeleton/data replacement left
        // the new node unobserved while the root border box stayed pinned.
        scrollViewRoot.append(probe);
        return true;
      },
      growthProbeTestId,
    );
    if (!insertedGrowthProbe) {
      throw new Error('Could not insert the Tabs.ScrollView growth probe');
    }
    await sleep(300);

    await wheelToBottom();
    await sleep(300);

    const metrics = await getMetrics();
    if (!metrics) throw new Error('Tabs scroll metrics are unavailable');
    const extentGrowth =
      metrics.maxScrollTop - beforeGrowthMetrics.maxScrollTop;
    const listContainerGrowth =
      metrics.listContainerHeight - beforeGrowthMetrics.listContainerHeight;
    const reproduced =
      headerShrinkFailure ||
      coldStartClipped ||
      tabRoundTripFailures > 0 ||
      extentGrowth < 90 ||
      listContainerGrowth < 90 ||
      !metrics.atBottom ||
      metrics.hiddenBelowScroller > 2 ||
      metrics.unmeasuredScrollViewOverflow > 2;
    log(
      `Tabs extent headerShrinkFailure=${headerShrinkFailure} coldStartClipped=${coldStartClipped} roundTripFailures=${tabRoundTripFailures}/${tabSwitchRounds} oldMax=${beforeGrowthMetrics.maxScrollTop.toFixed(
        1,
      )} scrollTop=${metrics.scrollTop.toFixed(1)}/${metrics.maxScrollTop.toFixed(
        1,
      )} container=${beforeGrowthMetrics.listContainerHeight.toFixed(
        1,
      )}->${metrics.listContainerHeight.toFixed(
        1,
      )} scrollView=${metrics.scrollViewHeight.toFixed(
        1,
      )}/${metrics.scrollViewScrollHeight}px content=${metrics.contentScrollHeight}px hidden=${metrics.hiddenBelowScroller.toFixed(
        1,
      )}px unmeasured=${metrics.unmeasuredScrollViewOverflow.toFixed(
        1,
      )}px viewport=${metrics.viewportWidth}x${metrics.viewportHeight}`,
    );

    if (reproduced) {
      const screenshotPath = path.resolve(
        '.tmp/ui/tabs-scroll-extent-desktop.png',
      );
      fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
      await page.screenshot({ path: screenshotPath });
      log(`evidence -> ${screenshotPath}`);
    }

    return report(
      'tabs-scroll-extent-desktop',
      reproduced ? 1 : 0,
      1,
      0,
      0,
      '',
    );
  } finally {
    await cleanupGrowthProbe();
  }
}

// Ported from the former cdp-repro-gift-storm.mjs. The detection
// signal — console "Maximum update depth", JS heap, evaluate RTT — is CDP-only,
// which is exactly why this scenario stays on CDP.
async function runGiftStormCdp(cdpUrl) {
  const FREEZE_RTT = Number(process.env.FREEZE_RTT || 2500);
  const STEP = Number(process.env.STEP_MS || 3000); // ~3s between tab switches (real avg)
  const HOME_DWELL = Number(process.env.HOME_DWELL_MS || 9000);

  const { page } = await connectCdpMainWindow(cdpUrl);
  log('driving', page.url().slice(0, 50));

  let errTotal = 0;
  let firstErr = '';
  const onErr = (t) => {
    if (ERR_RE.test(t)) {
      errTotal += 1;
      if (!firstErr) firstErr = t.split('\n')[0];
    }
  };
  page.on('console', (m) => onErr(m.text()));
  page.on('pageerror', (e) => onErr(e.message || String(e)));

  const ping = async () => {
    const t = Date.now();
    try {
      await Promise.race([
        page.evaluate('1'),
        sleep(FREEZE_RTT + 1500).then(() => Promise.reject(new Error('to'))),
      ]);
      return Date.now() - t;
    } catch {
      return Infinity;
    }
  };
  const heapMB = async () => {
    try {
      return await page.evaluate(
        '(performance.memory?Math.round(performance.memory.usedJSHeapSize/1048576):0)',
      );
    } catch {
      return -1;
    }
  };

  const ICON = {
    home: 'Wallet4',
    market: 'TradingViewCandles',
    swap: 'SwitchHor',
    perp: 'Trade',
    earn: 'Coins',
  };
  const tab = async (name) => {
    try {
      await page
        .locator(`[data-testid^="tab-modal"][data-testid*="${ICON[name]}"]`)
        .first()
        .click({ force: true, timeout: 2500 });
      return true;
    } catch {
      return false;
    }
  };
  const openSettings = async () => {
    for (const sel of [
      '[data-testid="me-settings"]',
      '[data-testid="web-settings-trigger"]',
      '[data-testid="web-account-panel-footer-settings"]',
    ]) {
      try {
        if (await page.locator(sel).count()) {
          await page.locator(sel).first().click({ force: true, timeout: 2500 });
          return true;
        }
      } catch {
        /* next */
      }
    }
    return false;
  };

  const round = async (i) => {
    const before = errTotal;
    await tab('earn');
    await sleep(STEP);
    const g = page.locator('[data-testid="header-gift-action"]').first();
    const box = await g.boundingBox().catch(() => null);
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await sleep(700);
    }
    await g.click({ force: true, timeout: 2500 }).catch(() => {});
    await page
      .locator('[data-testid="dialog-confirm-btn"]')
      .first()
      .waitFor({ state: 'visible', timeout: 4000 })
      .catch(() => {});
    await sleep(2000); // read dialog
    await page
      .locator('[data-testid="dialog-confirm-btn"]')
      .first()
      .click({ force: true, timeout: 2500 })
      .catch(() => {}); // → ReferFriends
    await sleep(STEP);
    await tab('swap');
    await sleep(STEP);
    await tab('perp');
    await sleep(1000);
    await tab('home');
    await sleep(HOME_DWELL);
    const setOpened = await openSettings();
    let frozen = false;
    for (let k = 0; k < 9; k += 1) {
      if (errTotal > before) break;
      const rtt = await ping();
      if (rtt >= FREEZE_RTT) {
        frozen = true;
        break;
      }
      await sleep(1000);
    }
    const hit = errTotal > before || frozen;
    const heap = await heapMB();
    log(
      `round ${String(i).padStart(2)}: settingsOpened=${setOpened} | ${
        hit ? '🔴 HIT' : '🟢 clean'
      } errors+${errTotal - before} heap=${heap === -1 ? 'FROZEN' : `${heap}MB`}`,
    );
    if (frozen || heap === -1) return { hit, frozen: true };
    await page.keyboard.press('Escape').catch(() => {});
    await sleep(500);
    return { hit, frozen: false };
  };

  let hits = 0;
  let ran = 0;
  let frozeAt = 0;
  log(`start heap=${await heapMB()}MB, rounds=${ROUNDS}`);
  for (let i = 1; i <= ROUNDS; i += 1) {
    ran = i;
    const r = await round(i);
    if (r.hit) hits += 1;
    if (r.frozen) {
      frozeAt = i;
      break;
    }
  }
  // Don't browser.close() — we're attached to the user's live app; main() exits
  // the process explicitly so the CDP connection won't keep it alive.
  return report('gift-storm-cdp', hits, ran, frozeAt, errTotal, firstErr);
}

// ===========================================================================
// agent-device backend — iOS / Android RN.
// ===========================================================================
// Run an agent-device subcommand. Returns { code, stdout, stderr }.
// `agent-device` must be on PATH (npm i -g agent-device).
function ad(args, { platform, timeoutMs = 15_000 } = {}) {
  const full = platform ? [...args, '--platform', platform] : args;
  return new Promise((resolve) => {
    const child = spawn('agent-device', full, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    let err = '';
    const killer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('error', (e) => {
      clearTimeout(killer);
      resolve({ code: -1, stdout: out, stderr: String(e.message || e) });
    });
    child.on('close', (code) => {
      clearTimeout(killer);
      resolve({ code, stdout: out, stderr: err });
    });
  });
}

// RN selectors — testIDs resolve via agent-device `find` (searches id). These
// mirror the desktop flow; confirm exact ids against a live device with
// `agent-device snapshot --json` and adjust here (mobile tab bar differs from
// the desktop icon-based tab-modal testIDs).
const RN = {
  giftAction: 'header-gift-action',
  dialogConfirm: 'dialog-confirm-btn',
  settings: 'me-settings',
  tabs: { earn: 'Earn', swap: 'Swap', perp: 'Trade', home: 'Wallet' }, // tab a11y labels/ids — VERIFY
};

// RESOLVED (2026-06-09, iPhone 16/17 Pro-class sim, agent-device 0.17.x):
// testID DOES work on OneKey iOS — `click 'id="..."'` / `is visible 'id="..."'` /
// `get attrs 'id="..."'` resolve via native accessibilityIdentifier even though
// `snapshot` returns a sparse tree. The real trap: the native CPU/RAM/fps perf
// overlay is a full-screen passthrough UIWindow (@onekeyfe/react-native-perf-stats)
// that swallows taps landing over its HUD box, so a testID `click` can print
// "Tapped" yet do nothing. Clear it first via the dev global
// `globalThis.$onekeyPerfMonitor.hide()` (callable over the RN Hermes CDP), or
// `get attrs` the rect and click a clear coordinate. Full writeup in skill
// 1k-ui-verify (references/rules/agent-device-rn.md).
//
// RN analog of gift-storm: open the gift overlay on Earn, storm tabs without
// closing it, land Home, open Settings, then probe for a freeze. Detection:
//   - command RTT balloons past FREEZE_MS (UI thread wedged), or
//   - the captured RN app log gains a "Maximum update depth"-class line.
async function runGiftStormRn(platform) {
  const FREEZE_MS = Number(process.env.FREEZE_MS || 4000);
  const STEP = Number(process.env.STEP_MS || 2500);
  const HOME_DWELL = Number(process.env.HOME_DWELL_MS || 7000);

  const probe = await ad(['--version']);
  if (probe.code !== 0) {
    throw new Error(
      'agent-device not found on PATH. Install: npm i -g agent-device',
    );
  }

  log(`open app on ${platform}`);
  const opened = await ad(['open', '--platform', platform], {
    timeoutMs: 120_000,
  });
  if (opened.code !== 0) {
    throw new Error(
      `agent-device open failed (${platform}). Is the simulator/emulator booted and the dev app installed? ` +
        `Run "yarn app:${platform}" first.\n${opened.stderr}`,
    );
  }
  await ad(['logs', 'clear'], { platform });

  // NOTE: standalone tap is `click`; find's action verb is `press` (version-
  // sensitive). testID resolves on OneKey iOS (see note above), so these match —
  // but disable/clear the perf overlay first or taps over its HUD box are eaten.
  const tap = (id) => ad(['find', id, 'press'], { platform, timeoutMs: 8000 });
  // Cheap responsiveness probe: time an appstate round-trip; a wedged UI thread
  // makes the automation call hang until our timeout.
  const rtt = async () => {
    const t = Date.now();
    const r = await ad(['appstate'], { platform, timeoutMs: FREEZE_MS + 2000 });
    return r.code === 0 ? Date.now() - t : Infinity;
  };
  const logHits = async () => {
    const p = await ad(['logs', 'path'], { platform });
    const logPath = p.stdout.trim().split('\n').pop();
    if (!logPath || !fs.existsSync(logPath)) return 0;
    const text = fs.readFileSync(logPath, 'utf8');
    return (text.match(new RegExp(ERR_RE, 'gi')) || []).length;
  };

  const round = async (i) => {
    const before = await logHits();
    await tap(RN.tabs.earn);
    await sleep(STEP);
    await tap(RN.giftAction); // open gift overlay
    await ad(['wait', RN.dialogConfirm, '4000'], { platform });
    await sleep(1500); // read dialog
    await tap(RN.dialogConfirm); // confirm → ReferFriends; FocusScope-ish teardown mid-nav
    await sleep(STEP);
    await tap(RN.tabs.swap);
    await sleep(STEP);
    await tap(RN.tabs.perp);
    await sleep(1000);
    await tap(RN.tabs.home);
    await sleep(HOME_DWELL);
    await tap(RN.settings); // open settings on heavy Home — the trigger
    let frozen = false;
    for (let k = 0; k < 6; k += 1) {
      const ms = await rtt();
      if (ms >= FREEZE_MS) {
        frozen = true;
        break;
      }
      await sleep(1000);
    }
    const after = await logHits();
    const hit = frozen || after > before;
    log(
      `round ${String(i).padStart(2)}: ${hit ? '🔴 HIT' : '🟢 clean'} ` +
        `logErrors+${after - before}${frozen ? ' FROZEN' : ''}`,
    );
    if (hit) {
      const shot = path.resolve(`.tmp/ui/gift-storm-rn-round${i}.png`);
      fs.mkdirSync(path.dirname(shot), { recursive: true });
      await ad(['screenshot', '--out', shot], { platform });
      log(`evidence -> ${shot}`);
    }
    return { hit, frozen };
  };

  let hits = 0;
  let ran = 0;
  let frozeAt = 0;
  for (let i = 1; i <= ROUNDS; i += 1) {
    ran = i;
    const r = await round(i);
    if (r.hit) hits += 1;
    if (r.frozen) {
      frozeAt = i;
      break;
    }
    await tap('Close'); // best-effort dismiss between rounds (ad() never rejects)
    await sleep(500);
  }
  await ad(['close'], { platform });
  return report(`gift-storm-rn-${platform}`, hits, ran, frozeAt, 0, '');
}

// ===========================================================================
// registry + dispatch
// ===========================================================================
const scenarios = {
  'dapp-cold-start-desktop': {
    backend: 'cdp',
    describe:
      'Open a desktop DApp from cold UI state and verify tab, active URL, and real webview render. CDP 9222.',
    run: (flags) =>
      runDappColdStartDesktop(
        process.env.CDP_URL_DESKTOP ||
          process.env.CDP_URL ||
          'http://127.0.0.1:9222',
        flags,
      ),
  },
  'tabs-scroll-extent-desktop': {
    backend: 'cdp',
    describe:
      'Detect Tabs.ScrollView clipping after DeFi/NFT round trips or async growth. CDP 9222.',
    run: () =>
      runTabsScrollExtentDesktop(
        process.env.CDP_URL_DESKTOP ||
          process.env.CDP_URL ||
          'http://127.0.0.1:9222',
      ),
  },
  'gift-storm-desktop': {
    backend: 'cdp',
    describe:
      'Electron FocusScope freeze (Earn gift overlay + tab storm + Settings). CDP 9222.',
    run: () =>
      runGiftStormCdp(
        process.env.CDP_URL_DESKTOP ||
          process.env.CDP_URL ||
          'http://127.0.0.1:9222',
      ),
  },
  'gift-storm-web': {
    backend: 'cdp',
    describe:
      'Same flow on the web build. Chrome --remote-debugging-port=9223 on the app:web URL.',
    run: () =>
      runGiftStormCdp(process.env.CDP_URL_WEB || 'http://127.0.0.1:9223'),
  },
  'gift-storm-rn': {
    backend: 'agent-device',
    describe:
      'RN (iOS/Android) analog. Drive via agent-device; freeze = command RTT + app-log errors.',
    run: (flags) =>
      runGiftStormRn(flags.platform === 'android' ? 'android' : 'ios'),
  },
};

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const flags = parseFlags(rest);

  if (!cmd || cmd === 'list' || cmd === '--help') {
    console.log('UI regression scenarios:\n');
    for (const [name, s] of Object.entries(scenarios)) {
      console.log(`  ${name.padEnd(20)} [${s.backend}]  ${s.describe}`);
    }
    console.log(
      '\nRun: node scenarios/regression.mjs <name> [--platform ios|android]',
    );
    process.exit(0);
  }

  const scenario = scenarios[cmd];
  if (!scenario) {
    console.error(
      `Unknown scenario "${cmd}". Try: node scenarios/regression.mjs list`,
    );
    process.exit(2);
  }
  const exit = await scenario.run(flags);
  process.exit(exit);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
