#!/usr/bin/env node

import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

function fail(message) {
  console.error(`[service-worker] ${message}`);
  process.exit(1);
}

const buildDirectory = resolve(
  process.argv[2] || new URL('../web-build', import.meta.url).pathname,
);
const serviceWorkerPath = resolve(buildDirectory, 'service-worker.js');
const serviceWorker = await readFile(serviceWorkerPath, 'utf8');
const forbiddenPatterns = [
  'process.env',
  '.toSorted(',
  '.toReversed(',
  '__TRADINGVIEW_EMBED_BUILD_MANIFEST_URL__',
  '__TRADINGVIEW_EMBED_BUILD_MANIFEST_INTEGRITY__',
  'TRADINGVIEW_EMBED_BUILD_MANIFEST_URL',
  'TRADINGVIEW_EMBED_BUILD_MANIFEST_INTEGRITY',
  // Remote chart hosts may only supply the release pinned in the app build.
  '/embed/latest.json',
];

for (const pattern of forbiddenPatterns) {
  if (serviceWorker.includes(pattern)) {
    fail(`compiled bundle contains forbidden pattern: ${pattern}`);
  }
}

const manifestFileNames = (await readdir(buildDirectory)).filter((fileName) =>
  /^tradingview-embed-manifest\.[a-zA-Z0-9][a-zA-Z0-9._-]*\.json$/.test(
    fileName,
  ),
);

if (manifestFileNames.length > 0) {
  fail('Web build must not bundle a TradingView embed manifest file');
}

console.log(
  '[service-worker] Remote TradingView manifests must match a pinned release.',
);

console.log('[service-worker] compiled bundle validation passed.');
