/* eslint-disable no-console */
/**
 * cdp-shot.mjs — drive the running OneKey desktop (Electron) renderer over CDP 9222
 * for AI-agent UI verification. Connects to the main window, optionally clicks a
 * testID, screenshots, and reports console errors seen during the run.
 *
 * Prerequisite: `yarn app:desktop` is running (its dev:main exposes --remote-debugging-port=9222).
 * Uses playwright-core, already a root dependency.
 *
 * Usage:
 *   node .claude/skills/1k-ui-verify/scripts/cdp-shot.mjs --out .tmp/ui/after.png
 *   node .claude/skills/1k-ui-verify/scripts/cdp-shot.mjs --testid tab-Earn --click --out .tmp/ui/earn.png
 *   node .claude/skills/1k-ui-verify/scripts/cdp-shot.mjs --testid amount-input --fill 0.5 --out .tmp/ui/filled.png
 *   node .claude/skills/1k-ui-verify/scripts/cdp-shot.mjs --url      # just print the main window url
 *
 * Env: CDP_URL (default http://127.0.0.1:9222), SETTLE_MS (default 300)
 */

import fs from 'node:fs';
import path from 'node:path';

import { chromium } from 'playwright-core';

const CDP_URL = process.env.CDP_URL || 'http://127.0.0.1:9222';
const SETTLE_MS = Number(process.env.SETTLE_MS || 300);

function parseArgs(argv) {
  const args = { click: false, urlOnly: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--click') args.click = true;
    else if (a === '--url') args.urlOnly = true;
    else if (a === '--out') args.out = argv[(i += 1)];
    else if (a === '--testid') args.testid = argv[(i += 1)];
    else if (a === '--fill') args.fill = argv[(i += 1)];
  }
  return args;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function findMainWindow(browser) {
  for (const ctx of browser.contexts()) {
    for (const page of ctx.pages()) {
      try {
        if ((await page.locator('[data-testid^="tab-modal"]').count()) > 0) {
          return page;
        }
      } catch {
        /* page may be navigating; skip */
      }
    }
  }
  return null;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  let browser;
  try {
    browser = await chromium.connectOverCDP(CDP_URL);
  } catch (e) {
    console.error(
      `Could not connect to CDP at ${CDP_URL}. Is "yarn app:desktop" running?\n${
        e.message || e
      }`,
    );
    process.exit(1);
  }

  const page = await findMainWindow(browser);
  if (!page) {
    const pages = browser
      .contexts()
      .flatMap((c) => c.pages().map((p) => p.url()))
      .join(', ');
    console.error(`OneKey main window not found on CDP. Found pages: ${pages}`);
    // Do NOT close the browser — it is the user's live app.
    process.exit(1);
  }

  if (args.urlOnly) {
    console.log(page.url());
    return;
  }

  const consoleErrors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text().split('\n')[0]);
  });
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));

  if (args.testid) {
    const el = page.locator(`[data-testid="${args.testid}"]`);
    const count = await el.count();
    if (count === 0) {
      console.error(
        `testID "${args.testid}" not found. Add a testID to the component or check the screen.`,
      );
      process.exit(2);
    }
    if (args.fill !== undefined) {
      await el.first().fill(args.fill);
      console.log(`filled [${args.testid}] = "${args.fill}"`);
    }
    if (args.click) {
      await el.first().click();
      console.log(`clicked [${args.testid}]`);
    }
    await sleep(SETTLE_MS);
  }

  if (args.out) {
    const outPath = path.resolve(args.out);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    await page.screenshot({ path: outPath });
    console.log(`screenshot -> ${outPath}`);
  }

  if (consoleErrors.length) {
    console.log(`console errors (${consoleErrors.length}):`);
    for (const line of consoleErrors.slice(0, 20)) console.log(`  ${line}`);
  } else {
    console.log('no console errors captured');
  }
  // Intentionally do not close the browser/context: we are attached to the live app.
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
