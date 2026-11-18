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
 * Env (Tabs): TAB_SWITCH_ROUNDS (default 8), HOME_TABS_EVIDENCE_DIR.
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

const HOME_TAB_TEST_IDS = [
  ['Spot', 'home-tab-portfolio', 'portfolio'],
  ['Perps', 'home-tab-perps', 'perps'],
  ['DeFi', 'home-tab-defi', 'defi'],
  ['NFT', 'home-tab-nft', 'nft'],
  ['History', 'home-tab-history', 'history'],
];
const HOME_BLANK_TOLERANCE_PX = 160;
const HOME_CLIP_TOLERANCE_PX = 2;

// Read the focused SDK owner and painted business content. A stretched pager
// wrapper cannot count as a painted leaf or prove that the real tail is reachable.
async function measureHomeTab(page) {
  return page.evaluate(() => {
    const visible = (element) => {
      const rect = element.getBoundingClientRect();
      if (
        rect.width <= 0 ||
        rect.height <= 0 ||
        rect.bottom <= 0 ||
        rect.top >= innerHeight
      )
        return false;
      for (let node = element; node; node = node.parentElement) {
        const style = getComputedStyle(node);
        if (
          style.display === 'none' ||
          style.visibility === 'hidden' ||
          node.hasAttribute('inert')
        )
          return false;
      }
      return true;
    };
    const owner = [
      ...document.querySelectorAll('[data-collapsible-pager-scroll]'),
    ].find(
      (node) =>
        node.getAttribute('data-collapsible-pager-active') === 'true' &&
        visible(node),
    );
    if (!(owner instanceof HTMLElement)) return null;
    const rect = owner.getBoundingClientRect();
    const fiberKey = Object.keys(owner).find((key) =>
      key.startsWith('__reactFiber'),
    );
    let pager = null;
    for (
      let fiber = fiberKey ? owner[fiberKey] : null, depth = 0;
      fiber && depth < 100;
      fiber = fiber.return, depth += 1
    ) {
      const instance = fiber.stateNode;
      if (
        instance &&
        typeof instance.pages === 'function' &&
        instance.configuredScrollElement
      ) {
        pager = {
          selected: instance.state.selectedPage,
          selectedKey: String(
            instance.pages()[instance.state.selectedPage]?.key ?? '',
          ).slice(2),
          ownerIsActual: instance.configuredScrollElement.element === owner,
          headerHeight: instance.headerSlot?.getBoundingClientRect().height,
          stickyHeight: instance.stickySlot?.getBoundingClientRect().height,
        };
        break;
      }
    }
    let paintedBottom = null;
    let paintedBottomAbs = 0;
    const isPainted = (node) => {
      if (['IMG', 'SVG', 'CANVAS', 'VIDEO'].includes(node.tagName)) return true;
      return [...node.childNodes].some(
        (child) => child.nodeType === 3 && child.textContent.trim(),
      );
    };
    for (const node of owner.querySelectorAll('*')) {
      if (node instanceof HTMLElement && isPainted(node)) {
        const leafRect = node.getBoundingClientRect();
        if (
          leafRect.width > 0 &&
          leafRect.height > 0 &&
          leafRect.right > rect.left &&
          leafRect.left < rect.right
        ) {
          let excluded = false;
          for (
            let ancestor = node;
            ancestor && ancestor !== owner;
            ancestor = ancestor.parentElement
          ) {
            const style = getComputedStyle(ancestor);
            if (
              style.display === 'none' ||
              style.visibility === 'hidden' ||
              style.position === 'fixed' ||
              style.position === 'sticky'
            ) {
              excluded = true;
              break;
            }
          }
          if (!excluded) {
            paintedBottomAbs = Math.max(
              paintedBottomAbs,
              leafRect.bottom - rect.top + owner.scrollTop,
            );
            if (leafRect.bottom > rect.top && leafRect.top < rect.bottom) {
              paintedBottom = Math.max(
                paintedBottom ?? 0,
                Math.min(leafRect.bottom, rect.bottom),
              );
            }
          }
        }
      }
    }
    const defiContent = owner.querySelector(
      '[data-testid="home-defi-tab-content"]',
    );
    const contentRect = defiContent?.getBoundingClientRect();
    const max = owner.scrollHeight - owner.clientHeight;
    const key = owner.getAttribute('data-collapsible-pager-scroll-key') || '';
    const isDefi = key.startsWith('defi:');
    return {
      key,
      active: owner.getAttribute('data-collapsible-pager-active'),
      top: owner.scrollTop,
      max,
      scrollHeight: owner.scrollHeight,
      clientHeight: owner.clientHeight,
      ownerRect: rect.toJSON(),
      pager,
      headerInset: owner.style
        .getPropertyValue('--ok-collapsible-pager-header-inset')
        .trim(),
      stickyInset: owner.style
        .getPropertyValue('--ok-collapsible-pager-sticky-inset')
        .trim(),
      atBottom: Math.abs(owner.scrollTop - max) <= 2,
      paintedBottom,
      paintedBottomAbs,
      blankSpacePx:
        paintedBottom === null
          ? Math.round(rect.height)
          : Math.round(Math.max(0, rect.bottom - paintedBottom)),
      // A short page can legitimately leave empty viewport below its content.
      // Dead space only exists when the owner can scroll far beyond its header.
      hasLongRange:
        max > (pager?.headerHeight ?? 0) + (pager?.stickyHeight ?? 0) + 160,
      defiReady:
        isDefi &&
        defiContent instanceof HTMLElement &&
        visible(defiContent) &&
        defiContent.querySelectorAll(
          '[data-testid="defi-protocol-header-link"]',
        ).length > 0 &&
        defiContent.querySelectorAll('[data-testid^="defi-position-action"]')
          .length > 0,
      defiContentBottom: contentRect?.bottom ?? null,
      defiContentHeight: contentRect?.height ?? null,
      // DeFi is a real, non-virtual content tree. Virtual Spot/NFT/History
      // instead gate on actual wheel reach and a painted tail at the bottom.
      clippedPx:
        isDefi && contentRect
          ? Math.round(
              Math.max(
                0,
                contentRect.bottom - rect.bottom,
                paintedBottomAbs - owner.scrollHeight,
              ),
            )
          : 0,
      viewport: { width: innerWidth, height: innerHeight },
    };
  });
}

async function saveHomeTabEvidence(page, name, data) {
  const directory = process.env.HOME_TABS_EVIDENCE_DIR;
  if (!directory) return;
  fs.mkdirSync(directory, { recursive: true });
  const stem = path.join(directory, name.replace(/[^a-z0-9-]/gi, '-'));
  fs.writeFileSync(
    `${stem}.json`,
    JSON.stringify({ at: new Date().toISOString(), ...data }, null, 2),
  );
  await page.screenshot({ path: `${stem}.png` });
}

function captureHomeUiErrors(page, scenario) {
  const counts = { console: 0, page: 0 };
  const file = process.env.HOME_TABS_EVIDENCE_DIR
    ? path.join(process.env.HOME_TABS_EVIDENCE_DIR, `${scenario}-errors.jsonl`)
    : null;
  const record = (kind, message) => {
    counts[kind] += 1;
    if (!file) return;
    const safeText = String(message)
      .replace(/https?:\/\/[^\s]+/g, '[url]')
      .replace(/0x[0-9a-fA-F]{40,}/g, '[address]')
      .replace(/[a-zA-Z0-9_=-]{60,}/g, '[redacted]')
      .slice(0, 500);
    fs.appendFileSync(
      file,
      `${JSON.stringify({ at: new Date().toISOString(), kind, text: safeText })}\n`,
    );
  };
  page.on('console', (message) => {
    if (message.type() === 'error') record('console', message.text());
  });
  page.on('pageerror', (error) => record('page', error.message));
  return counts;
}

async function gotoHomeTab(page, tab) {
  await page.locator(`[data-testid="${tab[1]}"]:visible`).click();
  await waitForCondition(
    `active ${tab[0]} SDK owner`,
    async () => {
      const measure = await measureHomeTab(page);
      return (
        measure?.key.startsWith(`${tab[2]}:`) &&
        measure.pager?.selectedKey === tab[2] &&
        measure.pager?.ownerIsActual === true
      );
    },
    20_000,
  );
  await sleep(350);
  return measureHomeTab(page);
}

async function wheelHomeTabToBottom(page, expectedTab) {
  let stable = 0;
  let priorMax = -1;
  for (let round = 0; round < 100; round += 1) {
    const before = await measureHomeTab(page);
    if (
      !before?.key.startsWith(`${expectedTab[2]}:`) ||
      before.pager?.ownerIsActual !== true
    ) {
      throw new Error(
        `${expectedTab[0]} lost its actual SDK owner while scrolling`,
      );
    }
    const rect = before.ownerRect;
    await page.mouse.move(
      rect.left + rect.width / 2,
      Math.min(rect.bottom - 80, rect.top + rect.height / 2),
    );
    await page.mouse.wheel(0, 950);
    await sleep(180);
    const after = await measureHomeTab(page);
    if (after?.atBottom && Math.abs(after.max - priorMax) <= 2) stable += 1;
    else stable = 0;
    priorMax = after?.max ?? -1;
    if (stable >= 4) return after;
  }
  const final = await measureHomeTab(page);
  throw new Error(
    `${expectedTab[0]} did not reach a stable real bottom: ${final?.top}/${final?.max}`,
  );
}

function homeTailChecks(sample, tab) {
  const ownerReady = Boolean(
    sample &&
    sample.active === 'true' &&
    sample.key.startsWith(`${tab[2]}:`) &&
    sample.pager?.selectedKey === tab[2] &&
    sample.pager?.ownerIsActual === true &&
    sample.pager.headerHeight > 0 &&
    sample.pager.stickyHeight > 0 &&
    sample.headerInset === `${sample.pager.headerHeight}px` &&
    sample.stickyInset === `${sample.pager.stickyHeight}px`,
  );
  return {
    ownerReady,
    atBottom: sample?.atBottom === true,
    paintedTail:
      typeof sample?.paintedBottom === 'number' &&
      (!sample.hasLongRange || sample.blankSpacePx <= HOME_BLANK_TOLERANCE_PX),
    contentFits: sample?.clippedPx <= HOME_CLIP_TOLERANCE_PX,
    defiBusinessReady: tab[2] !== 'defi' || sample?.defiReady === true,
  };
}

async function runTabsScrollExtentDesktop(cdpUrl) {
  const { page } = await connectCdpMainWindow(cdpUrl);
  const uiErrors = captureHomeUiErrors(page, 'extent');
  if (await page.locator('[data-testid="password-input"]:visible').count()) {
    throw new Error(
      'Desktop app is locked. Unlock before Home scroll verification.',
    );
  }
  const defi = HOME_TAB_TEST_IDS[2];
  const nft = HOME_TAB_TEST_IDS[3];
  const checks = [];
  await gotoHomeTab(page, defi);
  await waitForCondition(
    'real DeFi positions and protocols',
    async () => (await measureHomeTab(page))?.defiReady,
    45_000,
  );
  const ready = await measureHomeTab(page);
  await saveHomeTabEvidence(page, 'extent-defi-ready', {
    tab: defi[0],
    measure: ready,
  });
  checks.push({
    name: 'real DeFi data ready on actual owner',
    pass: homeTailChecks(ready, defi).ownerReady && ready.defiReady,
    detail: `key=${ready.key} H/S=${ready.headerInset}/${ready.stickyInset}`,
  });
  const firstBottom = await wheelHomeTabToBottom(page, defi);
  await saveHomeTabEvidence(page, 'extent-defi-first-bottom', {
    tab: defi[0],
    measure: firstBottom,
  });
  checks.push({
    name: 'initial DeFi tail reachable without clipping or dead scroll',
    pass: Object.values(homeTailChecks(firstBottom, defi)).every(Boolean),
    detail: `top=${firstBottom.top}/${firstBottom.max} blank=${firstBottom.blankSpacePx} clipped=${firstBottom.clippedPx}`,
  });

  const rounds = Number(process.env.TAB_SWITCH_ROUNDS || 8);
  for (let round = 1; round <= rounds; round += 1) {
    const savedTop = (await measureHomeTab(page)).top;
    await gotoHomeTab(page, nft);
    const nftBottom = await wheelHomeTabToBottom(page, nft);
    await saveHomeTabEvidence(page, `extent-nft-bottom-${round}`, {
      tab: nft[0],
      measure: nftBottom,
    });
    checks.push({
      name: `NFT real tail reachable round ${round}`,
      pass: Object.values(homeTailChecks(nftBottom, nft)).every(Boolean),
      detail: `top=${nftBottom.top}/${nftBottom.max} blank=${nftBottom.blankSpacePx}`,
    });
    await gotoHomeTab(page, defi);
    await sleep(650);
    const restored = await measureHomeTab(page);
    checks.push({
      name: `DeFi scroll restored after NFT round ${round}`,
      pass:
        homeTailChecks(restored, defi).ownerReady &&
        Math.abs(restored.top - savedTop) <= 2,
      detail: `saved=${savedTop} restored=${restored.top} max=${restored.max}`,
    });
    const bottom = await wheelHomeTabToBottom(page, defi);
    checks.push({
      name: `DeFi tail after NFT round ${round}`,
      pass: Object.values(homeTailChecks(bottom, defi)).every(Boolean),
      detail: `top=${bottom.top}/${bottom.max} blank=${bottom.blankSpacePx}`,
    });
  }

  // The overview More tile and the position Show more button control real
  // DeFi content. Their grow/shrink checks replace the old synthetic DOM probe.
  const content = page
    .locator('[data-testid="home-defi-tab-content"]:visible')
    .first();
  let toggle = page
    .locator('[data-testid="home-render-content-btn"]:visible')
    .first();
  if ((await toggle.count()) && /show less/i.test(await toggle.innerText())) {
    await toggle.click();
    await sleep(1700);
  }
  const collapsed = await wheelHomeTabToBottom(page, defi);
  const moreTile = content.locator('[role="button"][aria-label^="View more"]');
  toggle = page
    .locator('[data-testid="home-render-content-btn"]:visible')
    .first();
  const expansionTarget =
    (await toggle.count()) && /show more/i.test(await toggle.innerText())
      ? toggle
      : null;
  if (expansionTarget) {
    await expansionTarget.click();
    await sleep(1700);
    const expanded = await wheelHomeTabToBottom(page, defi);
    await saveHomeTabEvidence(page, 'extent-defi-more', {
      tab: defi[0],
      measure: expanded,
      beforeMax: collapsed.max,
    });
    checks.push({
      name: 'real DeFi More grows scrollable content and tail remains reachable',
      pass:
        expanded.max > collapsed.max + 20 &&
        Object.values(homeTailChecks(expanded, defi)).every(Boolean),
      detail: `max=${collapsed.max}->${expanded.max}`,
    });
    const less = page
      .locator('[data-testid="home-render-content-btn"]:visible')
      .first();
    if (!(await less.count()) || !/show less/i.test(await less.innerText())) {
      checks.push({
        name: 'DeFi Show less available after expansion',
        pass: false,
      });
    } else {
      await less.click();
      await sleep(1700);
      const shrunk = await wheelHomeTabToBottom(page, defi);
      await saveHomeTabEvidence(page, 'extent-defi-less', {
        tab: defi[0],
        measure: shrunk,
        beforeMax: expanded.max,
      });
      checks.push({
        name: 'real DeFi Less shrinks content without dead scroll',
        pass:
          shrunk.max < expanded.max - 20 &&
          Object.values(homeTailChecks(shrunk, defi)).every(Boolean),
        detail: `max=${expanded.max}->${shrunk.max}`,
      });
    }
  } else {
    checks.push({
      name: 'DeFi Show more/less available for this dataset',
      pass: false,
      detail: 'No visible Show more control',
    });
  }

  // The overview card has a separate More tile from the position list toggle.
  if (await moreTile.count()) {
    const overviewBefore = await measureHomeTab(page);
    await moreTile.first().click();
    await sleep(700);
    const overviewAfter = await wheelHomeTabToBottom(page, defi);
    await saveHomeTabEvidence(page, 'extent-defi-overview-more', {
      tab: defi[0],
      beforeMax: overviewBefore.max,
      measure: overviewAfter,
    });
    checks.push({
      name: 'DeFi overview More reveals real protocol cards',
      pass:
        overviewAfter.max > overviewBefore.max + 20 &&
        Object.values(homeTailChecks(overviewAfter, defi)).every(Boolean),
      detail: `max=${overviewBefore.max}->${overviewAfter.max}`,
    });
  }

  const stripState = () =>
    page.evaluate(() => {
      const button = document.querySelector(
        '[data-testid="home-defi-protocol-chip-scroll-right-btn"]',
      );
      const root = button?.parentElement?.parentElement;
      const scroller = [...(root?.querySelectorAll('*') ?? [])].find(
        (node) =>
          node instanceof HTMLElement &&
          node.scrollWidth - node.clientWidth > 20 &&
          node.clientWidth > 100,
      );
      const arrow = (direction) => {
        const element = document.querySelector(
          `[data-testid="home-defi-protocol-chip-scroll-${direction}-btn"]`,
        );
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        const hit = document.elementFromPoint(x, y);
        return {
          x,
          y,
          hit: hit === element || element.contains(hit),
          pointer: getComputedStyle(element).pointerEvents,
          parentOpacity: getComputedStyle(element.parentElement).opacity,
        };
      };
      return {
        left: scroller?.scrollLeft ?? null,
        max: scroller ? scroller.scrollWidth - scroller.clientWidth : null,
        leftArrow: arrow('left'),
        rightArrow: arrow('right'),
      };
    });
  const initialStrip = await stripState();
  let beforeRight = initialStrip;
  let afterLeft = null;
  if (initialStrip.rightArrow?.hit !== true && initialStrip.leftArrow?.hit) {
    await page.mouse.click(initialStrip.leftArrow.x, initialStrip.leftArrow.y);
    await sleep(550);
    afterLeft = await stripState();
    beforeRight = afterLeft;
  }
  let afterRight = null;
  if (beforeRight.rightArrow?.hit) {
    await page.mouse.click(beforeRight.rightArrow.x, beforeRight.rightArrow.y);
    await sleep(550);
    afterRight = await stripState();
  }
  await saveHomeTabEvidence(page, 'extent-defi-chip-arrows', {
    initialStrip,
    afterLeft,
    afterRight,
  });
  checks.push({
    name: 'sticky protocol strip arrows scroll horizontally by real pointer',
    pass:
      initialStrip.left !== null &&
      (afterLeft === null || afterLeft.left < initialStrip.left - 2) &&
      afterRight !== null &&
      afterRight.left > beforeRight.left + 2,
    detail: `${initialStrip.left}->${afterLeft?.left ?? '-'}->${afterRight?.left ?? '-'}`,
  });
  const chip = await page.evaluate(() => {
    const button = document.querySelector(
      '[data-testid="home-defi-protocol-chip-scroll-right-btn"]',
    );
    const root = button?.parentElement?.parentElement;
    if (!root) return null;
    const all = [...root.querySelectorAll('[role="button"]')].filter(
      (node) => !node.hasAttribute('data-testid'),
    );
    const labels = all.map((node) => node.innerText?.split('\n')[0] || '');
    const rect = root.getBoundingClientRect();
    for (let index = 0; index < all.length; index += 1) {
      const node = all[index];
      const r = node.getBoundingClientRect();
      const x = (r.left + r.right) / 2,
        y = (r.top + r.bottom) / 2;
      if (
        node.getAttribute('aria-current') !== 'location' &&
        labels[index] &&
        labels.filter((label) => label === labels[index]).length === 1 &&
        r.left >= rect.left + 4 &&
        r.right <= rect.right - 4 &&
        document.elementFromPoint(x, y)?.closest('[role="button"]') === node
      ) {
        return { index, x, y, name: labels[index] };
      }
    }
    return null;
  });
  if (!chip) {
    checks.push({
      name: 'visible inactive protocol chip available for navigation',
      pass: false,
    });
  } else {
    const before = await measureHomeTab(page);
    await page.mouse.click(chip.x, chip.y);
    await sleep(900);
    const readTarget = () =>
      page.evaluate((index) => {
        const button = document.querySelector(
          '[data-testid="home-defi-protocol-chip-scroll-right-btn"]',
        );
        const root = button?.parentElement?.parentElement;
        const chips = [
          ...(root?.querySelectorAll('[role="button"]') ?? []),
        ].filter((node) => !node.hasAttribute('data-testid'));
        const name = chips[index]?.innerText?.split('\n')[0] || '';
        const headers = [
          ...document.querySelectorAll(
            '[data-testid="defi-protocol-header-link"]',
          ),
        ]
          .map((link) => link.parentElement)
          .filter((node) => node?.innerText?.trim() === name);
        const header =
          headers.length === 1 ? headers[0].getBoundingClientRect() : null;
        const strip = root?.getBoundingClientRect();
        return {
          selected: chips[index]?.getAttribute('aria-current') === 'location',
          name,
          headerCount: headers.length,
          headerTop: header?.top ?? null,
          headerBottom: header?.bottom ?? null,
          stripBottom: strip?.bottom ?? null,
        };
      }, chip.index);
    const early = {
      at: Date.now(),
      top: (await measureHomeTab(page)).top,
      target: await readTarget(),
    };
    let priorTop = Number.NaN;
    let stableTopSamples = 0;
    await waitForCondition(
      'real protocol smooth navigation settles',
      async () => {
        const current = await measureHomeTab(page);
        stableTopSamples =
          Math.abs(current.top - priorTop) < 1 ? stableTopSamples + 1 : 0;
        priorTop = current.top;
        return stableTopSamples >= 3;
      },
      6000,
    );
    const result = await readTarget();
    const after = await measureHomeTab(page);
    const headerVisible =
      result.headerCount === 1 &&
      result.headerTop !== null &&
      result.headerBottom > result.stripBottom + 1 &&
      result.headerTop < after.ownerRect.bottom - 1;
    const headerAligned =
      headerVisible &&
      (Math.abs(result.headerTop - result.stripBottom) <= 24 || after.atBottom);
    await saveHomeTabEvidence(page, 'extent-defi-chip-navigation', {
      tab: defi[0],
      chip: chip.name,
      early,
      target: result,
      beforeTop: before.top,
      measure: after,
    });
    checks.push({
      name: 'real protocol chip navigates to its visible business header',
      pass:
        result.selected &&
        result.name === chip.name &&
        after.top !== before.top &&
        headerAligned &&
        homeTailChecks(after, defi).ownerReady,
      detail: `${chip.name} top=${before.top}->${after.top} header=${result.headerTop} stickyBottom=${result.stripBottom}`,
    });
  }

  const summary = {
    scenario: 'tabs-scroll-extent-desktop',
    at: new Date().toISOString(),
    checks,
    uiErrors,
  };
  if (process.env.HOME_TABS_EVIDENCE_DIR)
    fs.writeFileSync(
      path.join(process.env.HOME_TABS_EVIDENCE_DIR, 'extent-summary.json'),
      JSON.stringify(summary, null, 2),
    );
  return reportVerification('tabs-scroll-extent-desktop', checks);
}

async function runTabsBlankSpaceDesktop(cdpUrl) {
  const { page } = await connectCdpMainWindow(cdpUrl);
  const uiErrors = captureHomeUiErrors(page, 'blank');
  if (await page.locator('[data-testid="password-input"]:visible').count()) {
    throw new Error(
      'Desktop app is locked. Unlock before Home blank-space verification.',
    );
  }
  const available = [];
  for (const tab of HOME_TAB_TEST_IDS) {
    if (await page.locator(`[data-testid="${tab[1]}"]:visible`).count())
      available.push(tab);
  }
  if (available.length < 2 || !available.some((tab) => tab[2] === 'defi')) {
    throw new Error('Need visible Home DeFi and at least one other real tab');
  }
  const samples = [];
  const sample = async (label, tab, shot = false) => {
    await gotoHomeTab(page, tab);
    if (tab[2] === 'defi')
      await waitForCondition(
        'real DeFi business data',
        async () => (await measureHomeTab(page))?.defiReady,
        45_000,
      );
    const measure = await wheelHomeTabToBottom(page, tab);
    const checks = homeTailChecks(measure, tab);
    const row = { label, tab: tab[0], measure, checks };
    samples.push(row);
    log(
      `${label}: top=${measure.top}/${measure.max} blank=${measure.blankSpacePx} clipped=${measure.clippedPx} actual=${measure.pager?.ownerIsActual} ${Object.values(checks).every(Boolean) ? 'clean' : 'FAIL'}`,
    );
    if (shot) await saveHomeTabEvidence(page, `blank-${label}`, row);
  };
  for (const tab of available) await sample(`rest-${tab[0]}`, tab, true);
  for (const from of available) {
    for (const to of available.filter((tab) => tab !== from)) {
      await gotoHomeTab(page, from);
      await wheelHomeTabToBottom(page, from);
      await sample(
        `${from[0]}-to-${to[0]}`,
        to,
        to[2] === 'defi' || from[2] === 'defi',
      );
    }
  }
  if (process.env.HOME_TABS_EVIDENCE_DIR) {
    fs.writeFileSync(
      path.join(process.env.HOME_TABS_EVIDENCE_DIR, 'blank-samples.json'),
      JSON.stringify(samples, null, 2),
    );
    fs.writeFileSync(
      path.join(process.env.HOME_TABS_EVIDENCE_DIR, 'blank-ui-errors.json'),
      JSON.stringify(uiErrors, null, 2),
    );
  }
  const failed = samples.filter(
    (row) => !Object.values(row.checks).every(Boolean),
  );
  return reportVerification('tabs-blank-space-desktop', [
    {
      name: 'all Home tab transitions reach the requested actual SDK owner',
      pass: failed.every((row) => row.checks.ownerReady),
      detail: `${samples.length} measured samples`,
    },
    {
      name: 'real wheel reaches a stable bottom in every tab',
      pass: failed.every((row) => row.checks.atBottom),
      detail: `${samples.length} measured samples`,
    },
    {
      name: 'no dead scroll beyond painted business tail',
      pass: failed.every((row) => row.checks.paintedTail),
      detail: failed
        .filter((row) => !row.checks.paintedTail)
        .map((row) => `${row.label}:${row.measure.blankSpacePx}px`)
        .join(', '),
    },
    {
      name: 'DeFi real content not clipped',
      pass: failed.every((row) => row.checks.contentFits),
      detail: failed
        .filter((row) => !row.checks.contentFits)
        .map((row) => `${row.label}:${row.measure.clippedPx}px`)
        .join(', '),
    },
    {
      name: 'DeFi positions and protocols ready when sampled',
      pass: failed.every((row) => row.checks.defiBusinessReady),
    },
  ]);
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
      'Verify Home DeFi/NFT actual SDK scroll owner, real tails, More/less, and chip navigation. CDP 9222.',
    run: () =>
      runTabsScrollExtentDesktop(
        process.env.CDP_URL_DESKTOP ||
          process.env.CDP_URL ||
          'http://127.0.0.1:9222',
      ),
  },
  'tabs-blank-space-desktop': {
    backend: 'cdp',
    describe:
      'Verify real Home tab tails and limited dead-scroll checks after ordered tab switches. CDP 9222.',
    run: () =>
      runTabsBlankSpaceDesktop(
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
