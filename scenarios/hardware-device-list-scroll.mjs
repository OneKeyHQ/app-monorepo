// Run against a development Desktop app with an unlocked test profile:
// node scenarios/hardware-device-list-scroll.mjs
// Set HARDWARE_DEVICE_LIST_CDP_URL and HARDWARE_DEVICE_LIST_PAGE_URL to
// reuse the scenario against an extension popup or side panel.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

import { chromium } from 'playwright-core';

const outputDir =
  process.env.HARDWARE_DEVICE_LIST_OUTPUT_DIR || '.tmp/ui/ok-66329';
await mkdir(outputDir, { recursive: true });
const browser = await chromium.connectOverCDP(
  process.env.HARDWARE_DEVICE_LIST_CDP_URL || 'http://127.0.0.1:9222',
);
const pageUrl =
  process.env.HARDWARE_DEVICE_LIST_PAGE_URL || 'http://localhost:3001';
const page = browser
  .contexts()
  .flatMap((context) => context.pages())
  .find((candidate) => candidate.url().startsWith(pageUrl));
assert.ok(page, 'Open the target OneKey development page before this scenario');
const cdp = await page.context().newCDPSession(page);
// Extension SES disables page eval. Use the normal DevTools evaluation path
// without weakening SES or the extension's CSP for the scenario.
async function evaluateInPage(expression) {
  const { result, exceptionDetails } = await cdp.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  assert.equal(exceptionDetails, undefined, exceptionDetails?.text);
  return result.value;
}
console.log(
  'Viewport:',
  await evaluateInPage('({ width: innerWidth, height: innerHeight })'),
);

const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
await evaluateInPage(`
  globalThis.$$appGlobals.$rootAppNavigation.pushModal('DeveloperModal', {
    screen: 'component-CloudSync',
  });
`);
await page.getByTestId('hardware-device-list-mock-30').waitFor();

const rowId = (number) =>
  `onboarding-connect-your-device-item-mock-ble-${String(number).padStart(2, '0')}`;
const connect = page.getByTestId('onboarding-connect-your-device-connect-btn');

async function isHittable(testID) {
  return evaluateInPage(`(() => {
    const element = document.querySelector(${JSON.stringify(`[data-testid="${testID}"]`)});
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    const target = document.elementFromPoint(
      rect.x + rect.width / 2,
      rect.y + rect.height / 2,
    );
    return Boolean(target && element.contains(target));
  })()`);
}

async function wheelToEnd(direction) {
  // Wheel gestures, rather than scrollIntoView/click auto-scrolling, must
  // reveal the offscreen rows through the same path as the user's input.
  const list = page.getByTestId('onboarding-connect-your-device-list');
  const bounds = await list.boundingBox();
  assert.ok(bounds);
  await page.mouse.move(
    bounds.x + bounds.width / 2,
    bounds.y + bounds.height / 2,
  );
  for (let index = 0; index < 6; index += 1) {
    await page.mouse.wheel(0, direction * 700);
    await page.waitForTimeout(100);
  }
}

for (const count of [1, 3, 30]) {
  await page.getByTestId(`hardware-device-list-mock-${count}`).click();
  await connect.waitFor();
  await page.waitForTimeout(400);
  assert.equal(await isHittable(rowId(1)), true);
  assert.equal(
    await isHittable('onboarding-connect-your-device-connect-btn'),
    true,
  );
  if (count === 30) {
    assert.equal(await isHittable(rowId(30)), false);
    await wheelToEnd(1);
    assert.equal(await isHittable(rowId(30)), true);
    await wheelToEnd(-1);
    assert.equal(await isHittable(rowId(1)), true);
    await wheelToEnd(1);
    assert.equal(await isHittable(rowId(30)), true);
  }
  await page.getByTestId(rowId(count)).click();
  if (count > 1) {
    assert.equal(
      await isHittable('onboarding-connect-your-device-connect-btn'),
      true,
    );
    await page.screenshot({
      path: `${outputDir}/desktop-${count}-selected.png`,
    });
    await connect.click();
  }
  await page
    .getByTestId('hardware-device-list-mock-result')
    .filter({
      hasText: `Connected: mock-ble-${String(count).padStart(2, '0')}`,
    })
    .waitFor();
  console.log(`PASS: ${count} devices, last device selected and connected`);
}
assert.deepEqual(errors, [], 'No runtime errors during the picker scenario');
console.log(`Screenshots: ${outputDir}`);
// Disconnect without closing the user's Electron app.
process.exit(0);
