#!/usr/bin/env node

import { mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const DEFAULT_MANIFEST_URL = 'https://tradingview.onekey.so/embed/latest.json';
const MANIFEST_FETCH_TIMEOUT_MS = 30_000;
const LOCAL_HOSTNAMES = new Set(['127.0.0.1', 'localhost']);
const TRUSTED_MANIFEST_ORIGINS = new Set([
  'https://tradingview.onekey.so',
  'https://tradingview.onekeytest.com',
]);
const required = process.env.TRADINGVIEW_EMBED_REQUIRED === '1';
const configuredUrl =
  process.env.TRADINGVIEW_EMBED_MANIFEST_URL || DEFAULT_MANIFEST_URL;
const generatedManifestPath = resolve(
  import.meta.dirname,
  '../.generated/tradingview-embed-manifest.json',
);

await rm(generatedManifestPath, { force: true });

function fail(message) {
  console.error(`[tradingview-embed] ${message}`);
  process.exit(1);
}

function warnAndExit(message) {
  console.warn(`[tradingview-embed] ${message}`);
  process.exit(0);
}

function reportInvalid(message) {
  if (required) {
    fail(message);
  }
  warnAndExit(`${message}; Web will use the hosted iframe fallback.`);
}

function isValidRelativeAssetPath(file) {
  if (
    typeof file !== 'string' ||
    !file ||
    file.startsWith('/') ||
    file.includes('\\') ||
    file.includes('%') ||
    file.includes('?') ||
    file.includes('#')
  ) {
    return false;
  }
  const validationBaseUrl = new URL('https://tradingview.invalid/v1/embed/');
  const resolvedUrl = new URL(file, validationBaseUrl);
  return (
    resolvedUrl.origin === validationBaseUrl.origin &&
    resolvedUrl.href.startsWith(validationBaseUrl.href)
  );
}

function isValidManifestVersion(version) {
  return (
    typeof version === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(version)
  );
}

function isValidManifestPointer(manifest) {
  return (
    (manifest?.schema === 1 || manifest?.schema === 2) &&
    isValidManifestVersion(manifest.version) &&
    typeof manifest.baseUrl === 'string' &&
    Boolean(manifest.baseUrl) &&
    isValidRelativeAssetPath(manifest.entry)
  );
}

function getManifestStyles(manifest) {
  return manifest.schema === 1 ? manifest.styles || [] : [];
}

function isValidManifestV2Bootstrap(bootstrap, assetFiles, entry) {
  if (
    !bootstrap ||
    typeof bootstrap !== 'object' ||
    typeof bootstrap.defaultLocale !== 'string' ||
    !/^[A-Za-z][A-Za-z0-9_]*$/.test(bootstrap.defaultLocale) ||
    !Array.isArray(bootstrap.commonAssets) ||
    bootstrap.commonAssets.length === 0 ||
    !bootstrap.commonAssets.every(
      (file) => isValidRelativeAssetPath(file) && assetFiles.has(file),
    ) ||
    !bootstrap.commonAssets.includes(entry) ||
    !bootstrap.commonAssets.includes(
      'charting_library/charting_library.standalone.js',
    ) ||
    !bootstrap.localeAssets ||
    typeof bootstrap.localeAssets !== 'object' ||
    Array.isArray(bootstrap.localeAssets)
  ) {
    return false;
  }
  const localeEntries = Object.entries(bootstrap.localeAssets);
  return (
    localeEntries.length > 0 &&
    localeEntries.every(
      ([locale, files]) =>
        /^[A-Za-z][A-Za-z0-9_]*$/.test(locale) &&
        Array.isArray(files) &&
        files.length > 0 &&
        files.every(
          (file) => isValidRelativeAssetPath(file) && assetFiles.has(file),
        ),
    ) &&
    Object.prototype.hasOwnProperty.call(
      bootstrap.localeAssets,
      bootstrap.defaultLocale,
    )
  );
}

function isValidManifest(manifest) {
  if (
    isValidManifestPointer(manifest) &&
    Array.isArray(manifest.assets) &&
    manifest.assets.every(
      (asset) =>
        isValidRelativeAssetPath(asset?.file) &&
        typeof asset.integrity === 'string' &&
        /^sha384-[A-Za-z0-9+/]+={0,2}$/.test(asset.integrity) &&
        Number.isSafeInteger(asset.size) &&
        asset.size >= 0,
    )
  ) {
    const assetFiles = new Set(manifest.assets.map((asset) => asset.file));
    if (
      assetFiles.size !== manifest.assets.length ||
      !assetFiles.has(manifest.entry)
    ) {
      return false;
    }
    if (manifest.schema === 2) {
      return isValidManifestV2Bootstrap(
        manifest.bootstrap,
        assetFiles,
        manifest.entry,
      );
    }
    return (
      (manifest.styles === undefined ||
        (Array.isArray(manifest.styles) &&
          manifest.styles.every(
            (file) => isValidRelativeAssetPath(file) && assetFiles.has(file),
          ))) &&
      (manifest.bootstrapAssets === undefined ||
        (Array.isArray(manifest.bootstrapAssets) &&
          manifest.bootstrapAssets.every(
            (file) =>
              isValidRelativeAssetPath(file) &&
              assetFiles.has(file.replace('__LANG__', 'en')),
          )))
    );
  }
  return false;
}

let manifestUrl;
try {
  manifestUrl = new URL(configuredUrl);
} catch {
  reportInvalid('TradingView embed manifest URL is invalid');
}
const isLocalManifest = LOCAL_HOSTNAMES.has(manifestUrl.hostname);
if (
  (!isLocalManifest &&
    (manifestUrl.protocol !== 'https:' ||
      !TRUSTED_MANIFEST_ORIGINS.has(manifestUrl.origin))) ||
  (isLocalManifest &&
    manifestUrl.protocol !== 'http:' &&
    manifestUrl.protocol !== 'https:')
) {
  reportInvalid('TradingView embed manifest URL is not trusted');
}

const manifestResponse = await fetch(manifestUrl, {
  cache: 'no-store',
  signal: AbortSignal.timeout(MANIFEST_FETCH_TIMEOUT_MS),
}).catch(() => null);
if (!manifestResponse?.ok) {
  const message = `manifest request failed: ${
    manifestResponse?.status || 'network_error'
  }`;
  reportInvalid(message);
}

const manifestPointer = await manifestResponse.json().catch(() => null);
if (!isValidManifestPointer(manifestPointer)) {
  reportInvalid('latest.json is invalid');
}

const baseUrl = new URL(manifestPointer.baseUrl, manifestUrl);
if (baseUrl.origin !== manifestUrl.origin) {
  reportInvalid('manifest base URL origin mismatch');
}
if (!isLocalManifest) {
  const pathParts = baseUrl.pathname.split('/').filter(Boolean);
  const embedDirectory = pathParts.at(-1);
  const versionDirectory = pathParts.at(-2);
  if (
    embedDirectory !== 'embed' ||
    versionDirectory !== manifestPointer.version
  ) {
    reportInvalid(
      'manifest base URL must end with /<manifest.version>/embed/ to guarantee immutable assets',
    );
  }
}

let manifest = manifestPointer;
if (!isValidManifest(manifest)) {
  const versionManifestUrl = new URL('embed-manifest.json', baseUrl);
  const versionManifestResponse = await fetch(versionManifestUrl, {
    cache: 'no-store',
    signal: AbortSignal.timeout(MANIFEST_FETCH_TIMEOUT_MS),
  }).catch(() => null);
  if (!versionManifestResponse?.ok) {
    reportInvalid(
      `version manifest request failed: ${
        versionManifestResponse?.status || 'network_error'
      }`,
    );
  }
  manifest = await versionManifestResponse.json().catch(() => null);
  if (
    !isValidManifest(manifest) ||
    manifest.schema !== manifestPointer.schema ||
    manifest.version !== manifestPointer.version ||
    manifest.baseUrl !== manifestPointer.baseUrl ||
    manifest.entry !== manifestPointer.entry
  ) {
    reportInvalid('embed-manifest.json does not match latest.json');
  }
}

for (const file of [manifest.entry, ...getManifestStyles(manifest)]) {
  const assetUrl = new URL(file, baseUrl);
  if (
    assetUrl.origin !== baseUrl.origin ||
    !assetUrl.href.startsWith(baseUrl.toString())
  ) {
    reportInvalid('manifest asset URL escaped its version directory');
  }
}

await mkdir(resolve(generatedManifestPath, '..'), { recursive: true });
await writeFile(generatedManifestPath, `${JSON.stringify(manifest)}\n`, 'utf8');

console.log(
  `[tradingview-embed] validated ${manifestUrl.toString()} -> ${baseUrl.toString()}`,
);
