#!/usr/bin/env node

const DEFAULT_MANIFEST_URL = 'https://tradingview.onekey.so/embed/latest.json';
const MANIFEST_FETCH_TIMEOUT_MS = 30_000;
const required = process.env.TRADINGVIEW_EMBED_REQUIRED === '1';
const configuredUrl =
  process.env.TRADINGVIEW_EMBED_MANIFEST_URL || DEFAULT_MANIFEST_URL;

function fail(message) {
  console.error(`[tradingview-embed] ${message}`);
  process.exit(1);
}

function warnAndExit(message) {
  console.warn(`[tradingview-embed] ${message}`);
  process.exit(0);
}

function isValidRelativeAssetPath(file) {
  return (
    typeof file === 'string' &&
    Boolean(file) &&
    !file.startsWith('/') &&
    !file.includes('..') &&
    !file.includes('\\')
  );
}

function isValidManifest(manifest) {
  return (
    manifest?.schema === 1 &&
    typeof manifest.version === 'string' &&
    Boolean(manifest.version) &&
    typeof manifest.baseUrl === 'string' &&
    Boolean(manifest.baseUrl) &&
    isValidRelativeAssetPath(manifest.entry) &&
    Array.isArray(manifest.styles) &&
    manifest.styles.every(isValidRelativeAssetPath) &&
    (manifest.bootstrapAssets === undefined ||
      (Array.isArray(manifest.bootstrapAssets) &&
        manifest.bootstrapAssets.every(isValidRelativeAssetPath))) &&
    Array.isArray(manifest.assets) &&
    manifest.assets.every(
      (asset) =>
        isValidRelativeAssetPath(asset?.file) &&
        typeof asset.integrity === 'string' &&
        asset.integrity.startsWith('sha384-'),
    )
  );
}

let manifestUrl;
try {
  manifestUrl = new URL(configuredUrl);
} catch {
  fail('TradingView embed manifest URL is invalid');
}
if (required && manifestUrl.protocol !== 'https:') {
  fail('release builds require an HTTPS TradingView embed manifest URL');
}

const manifestResponse = await fetch(manifestUrl, {
  cache: 'no-store',
  signal: AbortSignal.timeout(MANIFEST_FETCH_TIMEOUT_MS),
}).catch(() => null);
if (!manifestResponse?.ok) {
  const message = `manifest request failed: ${
    manifestResponse?.status || 'network_error'
  }`;
  if (required) {
    fail(message);
  }
  warnAndExit(`${message}; Web will use the hosted iframe fallback.`);
}

const manifest = await manifestResponse.json().catch(() => null);
if (!isValidManifest(manifest)) {
  fail('latest.json is invalid');
}

const baseUrl = new URL(manifest.baseUrl, manifestUrl);
if (baseUrl.origin !== manifestUrl.origin) {
  fail('manifest base URL origin mismatch');
}
if (required) {
  const pathParts = baseUrl.pathname.split('/').filter(Boolean);
  const embedDirectory = pathParts.at(-1);
  const versionDirectory = pathParts.at(-2);
  if (embedDirectory !== 'embed' || versionDirectory !== manifest.version) {
    fail(
      'manifest base URL must end with /<manifest.version>/embed/ to guarantee immutable assets',
    );
  }
}

console.log(
  `[tradingview-embed] validated ${manifestUrl.toString()} -> ${baseUrl.toString()}`,
);
