#!/usr/bin/env node
/* eslint-disable no-console, onekey/no-raw-error -- standalone connected-device UI scenario */

import assert from 'node:assert/strict';

import {
  captureRuntimeErrors,
  connectToOneKey,
  screenshot,
  writeJsonArtifact,
} from './cdp.mjs';

const testIds = {
  accountSelector: 'AccountSelectorTriggerBase',
  accountSelectorHeader: 'account-selector-header',
  home: 'home',
  renameButton: 'account-manager-wallet-rename-button',
  renameInput: 'account-manager-wallet-rename-input',
  renameConfirm: 'account-manager-wallet-rename-confirm',
  renameError: 'account-manager-wallet-rename-error',
  renameFormError: 'account-manager-wallet-rename-input-message',
};

async function getInputVisualState(input) {
  return input.evaluate((element) => {
    let current = element;
    while (current) {
      const style = globalThis.getComputedStyle(current);
      if (
        style.borderTopStyle !== 'none' &&
        Number.parseFloat(style.borderTopWidth) > 0
      ) {
        return {
          borderColor: style.borderTopColor,
          borderWidth: style.borderTopWidth,
          tagName: current.tagName,
        };
      }
      current = current.parentElement;
    }
    return null;
  });
}

const { page } = await connectToOneKey();
const runtimeErrors = captureRuntimeErrors(page);
const useRealDeviceLabel = process.env.PRO2_REAL_LABEL === '1';
const reloadRenderer = process.env.PRO2_RELOAD === '1';
page.setDefaultTimeout(30_000);

if (reloadRenderer) {
  await page.goto('http://localhost:3001/', { waitUntil: 'domcontentloaded' });
  await page
    .locator('[data-testid^="tab-modal"]')
    .first()
    .waitFor({ state: 'attached', timeout: 60_000 });
  await page.waitForTimeout(2000);
}

await page.evaluate((useRealDeviceLabelInRenderer) => {
  const service = globalThis.$$appGlobals?.$backgroundApiProxy?.serviceHardware;
  if (!service) {
    throw new Error('serviceHardware is not available');
  }
  globalThis.__pro2LabelValidationTest = {
    getDeviceLabel: service.getDeviceLabel,
    setDeviceLabel: service.setDeviceLabel,
    setDeviceLabelCalls: 0,
  };
  if (!useRealDeviceLabelInRenderer) {
    service.getDeviceLabel = async () => 'OneKey Pro 333';
  }
  service.setDeviceLabel = async () => {
    globalThis.__pro2LabelValidationTest.setDeviceLabelCalls += 1;
  };
}, useRealDeviceLabel);

let report;
try {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const cancelButton = page.locator(
      '[data-testid="dialog-cancel-btn"]:visible',
    );
    const closeButton = page.locator(
      '[data-testid="nav-header-close"]:visible',
    );
    if ((await cancelButton.count()) > 0) {
      await cancelButton
        .last()
        .dispatchEvent('click', {}, { timeout: 1000 })
        .catch(() => undefined);
      await page.waitForTimeout(300);
    } else if ((await closeButton.count()) > 0) {
      await closeButton
        .last()
        .click({ force: true, timeout: 1000 })
        .catch(() => undefined);
      await page.waitForTimeout(300);
    } else {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(150);
    }
  }
  await page.locator(`[data-testid="${testIds.home}"]`).dispatchEvent('click');
  const accountSelector = page.locator(
    `[data-testid="${testIds.accountSelector}"]`,
  );
  await accountSelector.waitFor({ state: 'visible' });
  await accountSelector.dispatchEvent('click');
  const renameButton = page
    .locator(`[data-testid="${testIds.accountSelectorHeader}"]`)
    .locator(`[data-testid="${testIds.renameButton}"]`);
  await renameButton.waitFor({ state: 'visible' });
  await renameButton.dispatchEvent('click');

  const input = page.locator(`[data-testid="${testIds.renameInput}"]`).last();
  const confirm = page
    .locator(`[data-testid="${testIds.renameConfirm}"]`)
    .last();
  const error = page.locator(`[data-testid="${testIds.renameError}"]`).last();
  const formError = page
    .locator(`[data-testid="${testIds.renameFormError}"]`)
    .last();
  await input.waitFor({ state: 'visible' });
  const originalValue = await input.inputValue();

  await input.focus();
  await page.keyboard.press('Meta+A');
  await page.keyboard.type('OneKey Pro2 ');
  await page.keyboard.insertText('😂');
  await page.waitForTimeout(300);
  const invalidPreSubmitState = {
    inputVisualState: await getInputVisualState(input),
    confirmDisabled: await confirm.isDisabled(),
    errorVisible: await error.isVisible().catch(() => false),
  };
  assert.equal(
    invalidPreSubmitState.errorVisible,
    true,
    'Pro2 rename validation error should appear immediately after entering unsupported characters',
  );
  assert.equal(
    invalidPreSubmitState.confirmDisabled,
    false,
    'Pro2 rename confirmation should remain actionable so submit can reveal validation errors',
  );
  await confirm.dispatchEvent('click');
  await error.waitFor({ state: 'visible' });
  const invalidState = {
    confirmDisabled: await confirm.isDisabled(),
    errorText: await error.textContent().catch(() => null),
    errorVisible: await error.isVisible().catch(() => false),
  };
  const invalidScreenshot = await screenshot(page, '04-rename-invalid.png');

  assert.equal(
    invalidState.confirmDisabled,
    false,
    'Pro2 rename confirmation should remain actionable after validation fails',
  );
  assert.equal(
    invalidState.errorVisible,
    true,
    'Pro2 rename validation error should be visible for unsupported characters',
  );
  assert.ok(
    invalidState.errorText?.trim(),
    'Pro2 rename validation error should explain why the label is invalid',
  );

  const invalidSetDeviceLabelCalls = await page.evaluate(
    () => globalThis.__pro2LabelValidationTest?.setDeviceLabelCalls,
  );
  assert.equal(
    invalidSetDeviceLabelCalls,
    0,
    'Invalid Pro2 labels must not reach serviceHardware.setDeviceLabel',
  );

  await input.press('End');
  await input.press('Backspace');
  await page.waitForTimeout(300);
  const validState = {
    inputVisualState: await getInputVisualState(input),
    confirmDisabled: await confirm.isDisabled(),
    errorVisible: await error.isVisible().catch(() => false),
    formErrorVisible: await formError.isVisible().catch(() => false),
  };
  const validScreenshot = await screenshot(page, '05-rename-valid.png');
  assert.equal(
    validState.confirmDisabled,
    false,
    'Pro2 rename confirmation should be enabled for a supported label',
  );
  assert.equal(
    validState.errorVisible,
    false,
    'Pro2 rename validation error should clear after entering a supported label',
  );
  assert.equal(
    validState.formErrorVisible,
    false,
    'Pro2 rename must not retain a stale form error after removing unsupported characters',
  );
  assert.ok(
    invalidPreSubmitState.inputVisualState,
    'Pro2 rename input border should be measurable while invalid',
  );
  assert.ok(
    validState.inputVisualState,
    'Pro2 rename input border should be measurable after becoming valid',
  );
  assert.notEqual(
    validState.inputVisualState?.borderColor,
    invalidPreSubmitState.inputVisualState?.borderColor,
    'Pro2 rename input must clear the critical border after removing unsupported characters',
  );

  await input.fill(originalValue);
  await page.keyboard.press('Escape');

  report = {
    result: 'pass',
    invalidPreSubmitState,
    invalidSetDeviceLabelCalls,
    invalidState,
    useRealDeviceLabel,
    validState,
    runtimeErrors,
    screenshots: [invalidScreenshot, validScreenshot],
  };
} finally {
  await page.evaluate(() => {
    const service =
      globalThis.$$appGlobals?.$backgroundApiProxy?.serviceHardware;
    const testState = globalThis.__pro2LabelValidationTest;
    if (service && testState) {
      service.getDeviceLabel = testState.getDeviceLabel;
      service.setDeviceLabel = testState.setDeviceLabel;
    }
    delete globalThis.__pro2LabelValidationTest;
  });
}

const reportPath = await writeJsonArtifact(
  'label-validation-smoke.json',
  report,
);
console.log(`[pro2] PASS: report -> ${reportPath}`);
process.exit(0);
