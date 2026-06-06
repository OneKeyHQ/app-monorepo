/* eslint-disable no-console */
/**
 * cdp-repro-gift-storm.mjs — reproduce the FocusScope `Maximum update depth`
 * freeze by storming away while a FocusScope overlay is OPEN.
 *
 * Insight (confirmed): unmounting a page alone is clean. The error stack is
 * `safelyDetachRef` — a FocusScope overlay must be MOUNTED/OPEN when the storm
 * unmounts its subtree. The DeFi/Earn header GIFT icon (GiftAction →
 * HeaderIconButton with a `title` → wrapped in a tamagui <Tooltip>, and onPress
 * opens the referral <Dialog>) is a FocusScope overlay: hover mounts the
 * tooltip, click opens the dialog. (Requires testID="header-gift-action" on
 * GiftAction.)
 *
 * Round: go to Earn → open the gift overlay (hover tooltip + click dialog) →
 *        WITHOUT closing it, tab-storm → the open FocusScope subtree unmounts
 *        mid-open → setContainer(null) storm → Maximum update depth → freeze.
 *
 * Prerequisite: yarn app:desktop (CDP 9222) + heavy wallet + DevTools closed.
 * RUN: node apps/desktop/scripts/cdp-repro-gift-storm.mjs
 *      REGRESSION=1 node ...   # after fix: PASS only if 0 hits
 */

import { chromium } from 'playwright-core';

const CDP = process.env.CDP_URL || 'http://127.0.0.1:9222';
const REGRESSION = process.env.REGRESSION === '1';
const ROUNDS = Number(process.env.ROUNDS || 80);
const FREEZE_RTT = Number(process.env.FREEZE_RTT || 2500);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const hhmmss = () => new Date().toTimeString().slice(0, 8);
const log = (...a) => console.log(`[${hhmmss()}]`, ...a);

const browser = await chromium.connectOverCDP(CDP);
let page = null;
for (const c of browser.contexts()) {
  for (const p of c.pages()) {
    try {
      if ((await p.locator('[data-testid^="tab-modal"]').count()) > 0) {
        page = p;
        break;
      }
    } catch {
      /* */
    }
  }
  if (page) break;
}
if (!page) {
  console.error('main window not found');
  process.exit(1);
}
log('driving', page.url().slice(0, 50));

const ERR_RE = /Maximum update depth|FocusScope|compose-refs/i;
let errTotal = 0;
let firstErr = '';
page.on('console', (m) => {
  const t = m.text();
  if (ERR_RE.test(t)) {
    errTotal += 1;
    if (!firstErr) firstErr = t.split('\n')[0];
  }
});
page.on('pageerror', (e) => {
  const t = e.message || String(e);
  if (ERR_RE.test(t)) {
    errTotal += 1;
    if (!firstErr) firstErr = t.split('\n')[0];
  }
});

async function ping() {
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
}
async function heapMB() {
  try {
    return await page.evaluate(
      '(performance.memory?Math.round(performance.memory.usedJSHeapSize/1048576):0)',
    );
  } catch {
    return -1;
  }
}

const ICON = {
  home: 'Wallet4',
  market: 'TradingViewCandles',
  swap: 'SwitchHor',
  perp: 'Trade',
  earn: 'Coins',
};
async function tab(name) {
  try {
    await page
      .locator(`[data-testid^="tab-modal"][data-testid*="${ICON[name]}"]`)
      .first()
      .click({ force: true, timeout: 2500 });
    return true;
  } catch {
    return false;
  }
}

// PROVEN recipe (hit 13%/round; fast timing MISSES the window — the dialog's
// FocusScope teardown is a deferred startTransition, so tab switches must be
// HUMAN-SPACED to land while it's in-flight). Each round = one human-paced
// cycle; run many rounds for stability. Matches prod: gift→Confirm→ReferFriends
// →Home = freeze.
// timing halved vs the original human pace (~2× faster), but still far slower
// than the failed 50ms burst. Adds account-selector open/close (a Popover/Sheet
// = another FocusScope overlay) interleaved into the nav storm.
// Timing ALIGNED to the two prod freeze logs (renderer second-resolution):
//   L1: confirm→ReferFriends +3s→Home +10s→Settings +5s→freeze
//   L2: Earn +3s→ReferFriends +3s→Swap +1s→Perp +6s→Home +9s→Settings +7s→freeze
// Consistent trigger: land on Home, dwell ~9s, then SETTINGS modal (a FocusScope
// Dialog) opens → freeze ~5-7s later. ~3s between tab switches (not 850ms).
const STEP = Number(process.env.STEP_MS || 3000); // ~3s between tab switches (real avg)
const HOME_DWELL = Number(process.env.HOME_DWELL_MS || 9000); // real: 9-10s on Home before settings

async function openSettings() {
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
}

async function round(i) {
  const before = errTotal;
  // --- lead-up at REAL cadence ---
  await tab('earn');
  await sleep(STEP);
  // reach ReferFriends via the gift dialog confirm (L1's path; FocusScope Dialog
  // teardown during the switchTab nav)
  const g = page.locator('[data-testid="header-gift-action"]').first();
  const box = await g.boundingBox().catch(() => null);
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await sleep(700);
  }
  await g.click({ force: true, timeout: 2500 }).catch(() => {});
  try {
    await page
      .locator('[data-testid="dialog-confirm-btn"]')
      .first()
      .waitFor({ state: 'visible', timeout: 4000 });
  } catch {
    /* */
  }
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
  // --- land on Home and DWELL (the real precursor) ---
  await tab('home');
  await sleep(HOME_DWELL);
  // --- open Settings (FocusScope modal) on the heavy Home page → the trigger ---
  const setOpened = await openSettings();
  // watch ~9s (freeze hit ~5-7s after settings in both logs)
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
}

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

console.log('\n===== RESULT =====');
console.log(
  `hits ${hits}/${ran}${
    frozeAt ? ` (froze at round ${frozeAt})` : ''
  } | total Maximum-update-depth errors=${errTotal}`,
);
if (firstErr) console.log(`first error: ${firstErr}`);
const reproduced = hits > 0;
console.log(
  reproduced
    ? `🔴 REPRODUCED (hit rate ${Math.round((hits / ran) * 100)}%)`
    : '🟢 not reproduced this run',
);
try {
  await browser.close();
} catch {
  /* */
}
if (REGRESSION) {
  console.log(reproduced ? 'REGRESSION FAIL ❌' : 'REGRESSION PASS ✅');
  process.exit(reproduced ? 1 : 0);
}
process.exit(reproduced ? 0 : 3);
