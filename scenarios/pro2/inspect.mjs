#!/usr/bin/env node
/* eslint-disable no-console, onekey/no-raw-error -- standalone hardware UI inspection script */

import {
  captureRuntimeErrors,
  connectToOneKey,
  getVisibleTestIds,
  screenshot,
} from './cdp.mjs';

const { page } = await connectToOneKey();
const runtimeErrors = captureRuntimeErrors(page);

await page.waitForTimeout(500);
const testIds = await getVisibleTestIds(page);
const screenshotPath = await screenshot(page, 'inspect.png');

console.log(
  JSON.stringify(
    {
      runtimeErrors,
      screenshotPath,
      testIds,
      title: await page.title(),
      url: page.url(),
    },
    null,
    2,
  ),
);
process.exit(0);
