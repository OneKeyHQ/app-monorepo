/* eslint-disable no-console, onekey/no-raw-error -- standalone hardware UI test helper */

import fs from 'node:fs/promises';
import path from 'node:path';

import { chromium } from 'playwright-core';

const DEFAULT_CDP_URL = 'http://127.0.0.1:9222';
const DEFAULT_ARTIFACT_DIR = '.tmp/pro2-e2e';

export async function connectToOneKey() {
  const cdpUrl = process.env.PRO2_CDP_URL || DEFAULT_CDP_URL;
  const browser = await chromium.connectOverCDP(cdpUrl);
  const pages = browser.contexts().flatMap((context) => context.pages());

  for (const page of pages) {
    const isMainWindow = await page
      .locator('[data-testid^="tab-modal"]')
      .count()
      .catch(() => 0);
    if (isMainWindow > 0) {
      return { browser, page };
    }
  }

  const urls = pages.map((page) => page.url()).join(', ');
  throw new Error(`OneKey main window not found on ${cdpUrl}. Pages: ${urls}`);
}

export function captureRuntimeErrors(page) {
  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      const location = message.location();
      const source = location.url
        ? ` (${location.url}:${location.lineNumber + 1})`
        : '';
      errors.push(`console.error: ${message.text()}${source}`);
    }
  });
  page.on('pageerror', (error) => {
    errors.push(`pageerror: ${error.message}`);
  });
  return errors;
}

export async function ensureArtifactDir() {
  const artifactDir = path.resolve(
    process.env.PRO2_ARTIFACT_DIR || DEFAULT_ARTIFACT_DIR,
  );
  await fs.mkdir(artifactDir, { recursive: true });
  return artifactDir;
}

export async function getVisibleTestIds(page) {
  return page.locator('[data-testid]').evaluateAll((elements) =>
    elements
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        const style = globalThis.getComputedStyle(element);
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          style.display !== 'none' &&
          style.visibility !== 'hidden'
        );
      })
      .map((element) => ({
        id: element.getAttribute('data-testid'),
        text: (element.textContent || '')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 160),
      }))
      .filter((item) => item.id),
  );
}

export async function screenshot(page, fileName) {
  const artifactDir = await ensureArtifactDir();
  const screenshotPath = path.join(artifactDir, fileName);
  await page.screenshot({ path: screenshotPath });
  return screenshotPath;
}

export async function writeJsonArtifact(fileName, value) {
  const artifactDir = await ensureArtifactDir();
  const artifactPath = path.join(artifactDir, fileName);
  await fs.writeFile(artifactPath, `${JSON.stringify(value, null, 2)}\n`);
  return artifactPath;
}
