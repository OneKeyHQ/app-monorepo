#!/usr/bin/env node

import { createHash } from 'node:crypto';
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
const requirePinnedManifest = process.env.TRADINGVIEW_EMBED_REQUIRED === '1';
const forbiddenPatterns = [
  'process.env',
  '.toSorted(',
  '.toReversed(',
  '__TRADINGVIEW_EMBED_BUILD_MANIFEST_URL__',
  '__TRADINGVIEW_EMBED_BUILD_MANIFEST_INTEGRITY__',
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

if (manifestFileNames.length > 1) {
  fail('Web build contains multiple TradingView embed manifests');
}

const manifestFileName = manifestFileNames[0];
if (manifestFileName) {
  const manifestBytes = await readFile(
    resolve(buildDirectory, manifestFileName),
  );
  const integrity = `sha384-${createHash('sha384')
    .update(manifestBytes)
    .digest('base64')}`;
  if (!serviceWorker.includes(manifestFileName)) {
    fail('Service worker does not reference the pinned manifest');
  }
  if (!serviceWorker.includes(integrity)) {
    fail('Service worker manifest integrity does not match');
  }
  console.log(
    `[service-worker] verified pinned TradingView manifest: ${manifestFileName}`,
  );
} else {
  if (requirePinnedManifest) {
    fail('Web build does not contain a pinned TradingView embed manifest');
  }
  console.log(
    '[service-worker] no TradingView manifest was pinned; iframe fallback remains enabled.',
  );
}

console.log('[service-worker] compiled bundle validation passed.');
