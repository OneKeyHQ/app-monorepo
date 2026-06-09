#!/usr/bin/env node
/* eslint-disable no-console, onekey/no-raw-error -- standalone Node CLI script, no @onekeyhq/shared dependency */
/* cspell:ignore appstate */
/**
 * scenarios/regression.mjs — unified UI-freeze regression series.
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
 *   node scenarios/regression.mjs gift-storm-desktop          # CDP 9222 (yarn app:desktop)
 *   node scenarios/regression.mjs gift-storm-web              # CDP 9223 (Chrome --remote-debugging-port=9223 on the web build)
 *   node scenarios/regression.mjs gift-storm-rn --platform ios
 *   node scenarios/regression.mjs gift-storm-rn --platform android
 *
 * Env (shared): ROUNDS, REGRESSION=1 (exit 1 if reproduced, 0 if clean).
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
  for (const c of browser.contexts()) {
    for (const p of c.pages()) {
      try {
        if ((await p.locator('[data-testid^="tab-modal"]').count()) > 0) {
          page = p;
          break;
        }
      } catch {
        /* page may be navigating */
      }
    }
    if (page) break;
  }
  if (!page) {
    // Detach only — never browser.close(), it would kill the user's running app
    // (see references/rules/electron-cdp.md). connectOverCDP leaks no process.
    throw new Error('OneKey main window not found on CDP (no tab-modal root)');
  }
  return { browser, page };
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
    console.log('UI-freeze regression scenarios:\n');
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
