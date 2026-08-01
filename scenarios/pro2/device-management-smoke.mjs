#!/usr/bin/env node
/* eslint-disable no-console, onekey/no-raw-error -- standalone connected-device UI scenario */

import assert from 'node:assert/strict';

import {
  captureRuntimeErrors,
  connectToOneKey,
  screenshot,
  writeJsonArtifact,
} from './cdp.mjs';

const expectedDeviceText = process.env.PRO2_DEVICE_MATCH || 'Pro2';
const skipWallpaper = process.env.PRO2_SKIP_WALLPAPER === '1';
const reloadRenderer = process.env.PRO2_RELOAD === '1';
const nonBlockingErrorPatterns = [
  /getAddressEncodingByAddress error OneKeyErrorNotImplemented/u,
  /http:\/\/localhost:4747\/(?:health|sessions)/u,
  /MISSING_TRANSLATION[\s\S]*Missing message: "Wallpaper added"/u,
  /React does not recognize[\s\S]*iconColor iconcolor/u,
  /contains children in Portal\.Body/u,
];
const report = {
  device: {},
  runtimeErrors: [],
  screenshots: [],
  steps: [],
};

function recordStep(name, details = {}) {
  const step = { name, ...details };
  report.steps.push(step);
  console.log(`[pro2] ${name}`, details);
}

async function capture(page, fileName) {
  const outputPath = await screenshot(page, fileName);
  report.screenshots.push(outputPath);
  return outputPath;
}

const { page } = await connectToOneKey();
report.runtimeErrors = captureRuntimeErrors(page);
page.setDefaultTimeout(30_000);

if (reloadRenderer) {
  await page.reload({ waitUntil: 'domcontentloaded' });
}
await page
  .locator('[data-testid^="tab-modal"]')
  .first()
  .waitFor({ state: 'attached', timeout: 60_000 });
await page
  .locator('[data-testid="Desktop-AppSideBar-Container"]')
  .waitFor({ state: 'visible', timeout: 60_000 });
await page.waitForTimeout(1500);

// Close popovers and modals left by previous scenarios so they cannot intercept
// the side navigation click. Development navigation can preserve several
// stacked routes across renderer updates.
for (let attempt = 0; attempt < 10; attempt += 1) {
  const closeButton = page.locator('[data-testid="nav-header-close"]:visible');
  if ((await closeButton.count()) > 0) {
    await closeButton.last().click({ force: true });
    await page.waitForTimeout(500);
  } else {
    const popover = page.locator('[data-testid="ovelay-popover"]:visible');
    if ((await popover.count()) > 0) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    } else {
      const backdrop = page.locator(
        '[data-testid="app-modal-stacks-backdrop"]:visible',
      );
      if ((await backdrop.count()) > 0) {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      } else {
        break;
      }
    }
  }
}

await capture(page, '00-wallet.png');

const deviceManagementTab = page.locator('[data-testid="devicemanagement"]');
await deviceManagementTab.waitFor({ state: 'visible' });

const deviceItems = page.locator(
  '[data-testid="device-mgmt-device-list-item"]',
);
for (let attempt = 0; attempt < 2; attempt += 1) {
  await deviceManagementTab.dispatchEvent('click');
  const deviceListIsVisible = await deviceItems
    .first()
    .waitFor({ state: 'visible', timeout: 10_000 })
    .then(() => true)
    .catch(() => false);
  if (deviceListIsVisible) break;
  await page.waitForTimeout(1000);
}
await deviceItems.first().waitFor({ state: 'visible' });

const deviceTexts = await deviceItems.allTextContents();
const targetIndex = deviceTexts.findIndex((text) =>
  text.toLowerCase().includes(expectedDeviceText.toLowerCase()),
);
assert.notEqual(
  targetIndex,
  -1,
  `Expected a device containing "${expectedDeviceText}", found ${JSON.stringify(
    deviceTexts,
  )}`,
);

const targetDevice = deviceItems.nth(targetIndex);
const targetDeviceText = deviceTexts[targetIndex].replace(/\s+/g, ' ').trim();
report.device = { index: targetIndex, text: targetDeviceText };
recordStep('Pro2 device appears in device management', {
  text: targetDeviceText,
});

const connectedStatus = targetDevice.locator(
  '[data-testid="device-mgmt-device-status-connected"]',
);
const disconnectedStatus = targetDevice.locator(
  '[data-testid="device-mgmt-device-status-disconnected"]',
);
let initialConnectionStatus = 'unknown';
if (await connectedStatus.isVisible()) {
  initialConnectionStatus = 'connected';
} else if (await disconnectedStatus.isVisible()) {
  initialConnectionStatus = 'idle';
}
report.device.initialConnectionStatus = initialConnectionStatus;
recordStep('Pro2 initial connection state captured', {
  status: initialConnectionStatus,
});
await capture(page, '01-device-list.png');

await targetDevice.dispatchEvent('click');
const detailsContent = page.locator('[data-testid="device-details-content"]');
await detailsContent.waitFor({ state: 'visible', timeout: 60_000 });

// A modal owned by another concurrently tested feature may restore itself after
// the route switch. Close it now that the Pro2 detail route is active.
for (let attempt = 0; attempt < 3; attempt += 1) {
  const retainedModalClose = page.locator(
    '[data-testid="nav-header-close"]:visible',
  );
  if ((await retainedModalClose.count()) === 0) break;
  await retainedModalClose.last().click({ force: true });
  await page.waitForTimeout(500);
}

const troubleshootingButton = page.locator(
  '[data-testid="hardware-ui-troubleshooting-btn"]',
);
if (await troubleshootingButton.isVisible()) {
  await capture(page, '02-device-not-connected.png');
  throw new Error(
    'Device details triggered the Device not connected dialog during its initial snapshot query',
  );
}

const wallpaperItem = page.locator(
  '[data-testid="device-mgmt-wallpaper-item"]',
);
const passphraseSwitch = page.locator(
  '[data-testid="device-mgmt-passphrase-switch"]',
);
await wallpaperItem.waitFor({ state: 'visible' });
await passphraseSwitch.waitFor({ state: 'attached' });
recordStep('Pro2 details expose wallpaper and passphrase controls');
await wallpaperItem.scrollIntoViewIfNeeded();
await capture(page, '02-device-details.png');

if (!skipWallpaper) {
  await wallpaperItem.click();
  const wallpaperPage = page.locator('[data-testid="hardware-wallpaper-page"]');
  await wallpaperPage.waitFor({ state: 'visible', timeout: 60_000 });

  const uploadButton = page.locator(
    '[data-testid="account-manager-upload-button-icon-btn"]',
  );
  const applyButton = page.locator(
    '[data-testid="hardware-wallpaper-apply-button"]',
  );
  await uploadButton.waitFor({ state: 'visible', timeout: 60_000 });
  await applyButton.waitFor({ state: 'visible' });
  const cobrandingItems = page.locator(
    '[data-testid^="hardware-wallpaper-cobranding-"]',
  );
  await cobrandingItems.first().waitFor({ state: 'visible', timeout: 60_000 });
  await page.waitForFunction(() => {
    const images = Array.from(
      document.querySelectorAll(
        '[data-testid^="hardware-wallpaper-cobranding-"] img',
      ),
    );
    return (
      images.length > 0 &&
      images.every(
        (image) =>
          image instanceof HTMLImageElement &&
          image.complete &&
          image.naturalWidth > 0 &&
          image.naturalHeight > 0,
      )
    );
  });
  assert.ok(
    (await cobrandingItems.count()) >= 4,
    'Expected at least four loaded Pro2 co-branding wallpaper candidates',
  );
  assert.equal(
    await applyButton.isDisabled(),
    true,
    'Wallpaper apply button should remain disabled until a wallpaper is selected',
  );
  recordStep(
    'Pro2 wallpaper candidates and custom upload entry render safely',
    {
      cobrandingCount: await cobrandingItems.count(),
    },
  );
  await page.waitForTimeout(500);
  await capture(page, '03-wallpaper-page.png');
}

await page.waitForTimeout(500);
report.nonBlockingRuntimeErrors = report.runtimeErrors.filter((error) =>
  nonBlockingErrorPatterns.some((pattern) => pattern.test(error)),
);
report.blockingRuntimeErrors = report.runtimeErrors.filter(
  (error) => !nonBlockingErrorPatterns.some((pattern) => pattern.test(error)),
);
report.result = report.blockingRuntimeErrors.length === 0 ? 'pass' : 'fail';
const reportPath = await writeJsonArtifact(
  'device-management-smoke.json',
  report,
);
assert.deepEqual(
  report.blockingRuntimeErrors,
  [],
  `Blocking renderer errors occurred during the scenario: ${report.blockingRuntimeErrors.join('\n')}`,
);

console.log(`[pro2] PASS: report -> ${reportPath}`);
process.exit(0);
