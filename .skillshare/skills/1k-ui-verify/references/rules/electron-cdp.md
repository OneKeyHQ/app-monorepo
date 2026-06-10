# Desktop UI verification via CDP 9222

The Electron renderer is Chromium, so drive it with `playwright-core`'s `connectOverCDP`. This is
the same convention the repo already uses (`scenarios/regression.mjs`,
`apps/desktop/e2e/open-url.e2e.js`).

## Contents
- Prerequisites
- Connect and find the main window
- Capture: screenshot, console, DOM
- Interact by testID
- Helper script
- Pitfalls

## Prerequisites

- `yarn app:desktop` is running. Its `dev:main` script
  (`apps/desktop/package.json`) launches:
  `electron --inspect=5858 --remote-debugging-port=9222 --remote-debugging-address=127.0.0.1 app/dist/app.js`
  → CDP endpoint at `http://127.0.0.1:9222`.
- `playwright-core` is already a root dependency (`^1.50.0`). No install.
- CDP is dev-only; packaged/production builds do not expose 9222.

## Connect and find the main window

An Electron app exposes multiple targets (main window, hidden webviews, devtools). The OneKey main
window is the page that contains the tab-modal root.

```js
import { chromium } from 'playwright-core';

const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
let page = null;
for (const ctx of browser.contexts()) {
  for (const p of ctx.pages()) {
    try {
      if ((await p.locator('[data-testid^="tab-modal"]').count()) > 0) {
        page = p;
        break;
      }
    } catch { /* page may be navigating */ }
  }
  if (page) break;
}
if (!page) throw new Error('OneKey main window not found on CDP 9222');
```

Do **not** `browser.close()` — it would kill the user's running app. Just let the script exit.

## Capture

```js
// Screenshot
await page.screenshot({ path: '.tmp/ui/after.png' });

// Console errors (attach BEFORE the interaction)
page.on('console', (m) => { if (m.type() === 'error') console.log('console.error:', m.text()); });
page.on('pageerror', (e) => console.log('pageerror:', e.message));

// Read a value / DOM state
const text = await page.locator('[data-testid="account-balance"]').innerText();
```

## Interact by testID

```js
await page.locator('[data-testid="header-gift-action"]').click();
await page.locator('[data-testid="amount-input"]').fill('0.5');
await page.locator('[data-testid="tab-Earn"]').click();
await page.waitForTimeout(300); // let RN/tamagui settle before screenshot
```

If the target has no `testID`, add one to the component first
(`grep -rn 'testID' packages/kit/src/views/<area>`), rebuild the renderer, then verify. Avoid
text/role selectors — i18n and tamagui wrappers make them brittle.

## Helper script

`scripts/cdp-shot.mjs` wraps the above: connect → find main window → optional `--click` on a
`--testid` → screenshot to `--out` → print console errors seen during the run.

```bash
node .claude/skills/1k-ui-verify/scripts/cdp-shot.mjs --out .tmp/ui/after.png
node .claude/skills/1k-ui-verify/scripts/cdp-shot.mjs --testid tab-Earn --click --out .tmp/ui/earn.png
node .claude/skills/1k-ui-verify/scripts/cdp-shot.mjs --url   # just print the main window url to confirm connection
```

## Pitfalls

- **Wrong window**: the first page is often not the main window. Always filter by the tab-modal
  testID as above.
- **DevTools open**: when reproducing render-storm/freeze bugs, close DevTools first — an open
  inspector changes timing and can mask or alter the bug (see the gift-storm repro notes).
- **Timing**: tamagui animations and RN-web layout settle async. `waitForTimeout(200–400)` (or
  wait for a specific testID to appear) before screenshotting.
- **Don't close the browser/context** — you are attached to the user's live app.
- **Multiple Electron instances**: if another Electron app is on 9222, point `CDP_URL` elsewhere or
  ensure only OneKey dev is running.
