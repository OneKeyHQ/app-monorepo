/* eslint-disable no-restricted-globals */
/* eslint-disable unicorn/prefer-global-this */
/* global __TRADINGVIEW_EMBED_BUILD_MANIFEST_INTEGRITY__, __TRADINGVIEW_EMBED_BUILD_MANIFEST_URL__ */
import { ExpirationPlugin } from 'workbox-expiration';
import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';

const VERSION_MANIFEST_URL = '/sw-version-manifest.json';
const INDEX_HTML_URL = '/index.html';
const INTERNAL_STATE_CACHE = 'onekey-web-version-state';
const INTERNAL_STATE_URL = '/__onekey_web_version_state__';
const HTML_CACHE_PREFIX = 'onekey-web-html:';
const CRITICAL_CACHE_PREFIX = 'onekey-web-critical:';
const CRITICAL_TEMP_CACHE_PREFIX = 'onekey-web-critical-temp:';
const STATIC_RESOURCES_CACHE = 'static-resources';
const STATIC_RESOURCES_MAX_ENTRIES = 300;
const STATIC_RESOURCES_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const STATIC_RESOURCE_CACHE_TIME_HEADER = 'x-onekey-cache-time';
const PREVIOUS_VERSION_LIMIT = 1;
const TRADINGVIEW_EMBED_CACHE_PREFIX = 'onekey-tradingview-embed:';
const TRADINGVIEW_PREFETCH_CONCURRENCY = 3;
const DEFAULT_TRADINGVIEW_EMBED_MANIFEST_URL =
  'https://tradingview.onekey.so/embed/latest.json';
const TRADINGVIEW_EMBED_BUILD_MANIFEST_URL =
  __TRADINGVIEW_EMBED_BUILD_MANIFEST_URL__;
const TRADINGVIEW_EMBED_BUILD_MANIFEST_INTEGRITY =
  __TRADINGVIEW_EMBED_BUILD_MANIFEST_INTEGRITY__;
const LOCAL_HOSTNAMES = new Set(['127.0.0.1', 'localhost']);
const TRUSTED_TRADINGVIEW_MANIFEST_ORIGINS = new Set([
  'https://tradingview.onekey.so',
  'https://tradingview.onekeytest.com',
]);

const MESSAGE_TYPES = {
  GET_VERSION_STATE: 'GET_VERSION_STATE',
  CHECK_VERSION: 'CHECK_VERSION',
  ACTIVATE_VERSION: 'ACTIVATE_VERSION',
  VERSION_STATE: 'VERSION_STATE',
  UPDATE_CHECKING: 'UPDATE_CHECKING',
  UPDATE_READY: 'UPDATE_READY',
  UPDATE_FAILED: 'UPDATE_FAILED',
  VERSION_ACTIVATED: 'VERSION_ACTIVATED',
  PREFETCH_TRADINGVIEW_EMBED: 'PREFETCH_TRADINGVIEW_EMBED',
};

let versionCheckPromise = null;
const tradingViewPrefetchPromises = new Map();
const tradingViewManifestStates = new Map();

// Precache app shell (manifest injected by InjectManifest at build time)
precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

class ServiceWorkerVersionError extends Error {
  constructor(code) {
    super('Service worker version update failed');
    this.name = 'ServiceWorkerVersionError';
    this.code = code;
  }
}

function getVersionErrorCode(error) {
  if (error instanceof ServiceWorkerVersionError) {
    return error.code;
  }
  return 'update_failed';
}

function getInternalStateRequest() {
  return new Request(
    new URL(INTERNAL_STATE_URL, self.location.origin).toString(),
  );
}

function getDefaultState() {
  return {
    activeVersion: '',
    readyVersion: '',
    activeManifest: undefined,
    readyManifest: undefined,
    previousVersions: [],
    failedVersion: '',
    retryAt: 0,
    lastError: '',
  };
}

async function readVersionState() {
  const cache = await caches.open(INTERNAL_STATE_CACHE);
  const response = await cache.match(getInternalStateRequest());
  if (!response) {
    return getDefaultState();
  }
  try {
    return {
      ...getDefaultState(),
      ...(await response.json()),
    };
  } catch {
    return getDefaultState();
  }
}

async function writeVersionState(state) {
  const cache = await caches.open(INTERNAL_STATE_CACHE);
  await cache.put(
    getInternalStateRequest(),
    new Response(JSON.stringify(state), {
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

function sendMessageToClient(client, type, payload = {}) {
  if (client) {
    client.postMessage({ type, payload });
  }
}

async function broadcastMessage(type, payload = {}) {
  const clients = await self.clients.matchAll({
    includeUncontrolled: false,
    type: 'window',
  });
  clients.forEach((client) => {
    sendMessageToClient(client, type, payload);
  });
}

function getHtmlCacheName(version) {
  return `${HTML_CACHE_PREFIX}${version}`;
}

function getCriticalCacheName(version) {
  return `${CRITICAL_CACHE_PREFIX}${version}`;
}

function getCriticalTempCacheName(version) {
  return `${CRITICAL_TEMP_CACHE_PREFIX}${version}`;
}

async function deleteVersionCaches(version) {
  if (!version) {
    return;
  }
  await Promise.all([
    caches.delete(getHtmlCacheName(version)),
    caches.delete(getCriticalCacheName(version)),
    caches.delete(getCriticalTempCacheName(version)),
  ]);
}

function isValidManifest(manifest) {
  return (
    manifest &&
    manifest.schema === 1 &&
    typeof manifest.version === 'string' &&
    Boolean(manifest.version) &&
    typeof manifest.publicUrl === 'string' &&
    Array.isArray(manifest.critical)
  );
}

function getManifestBuildTime(manifest) {
  const buildTime = Number(manifest?.buildTime);
  return Number.isFinite(buildTime) && buildTime > 0 ? buildTime : 0;
}

function isManifestOlderThan(candidateManifest, baselineManifest) {
  const candidateBuildTime = getManifestBuildTime(candidateManifest);
  const baselineBuildTime = getManifestBuildTime(baselineManifest);
  return Boolean(
    candidateBuildTime &&
    baselineBuildTime &&
    candidateBuildTime < baselineBuildTime,
  );
}

async function fetchVersionManifest() {
  const response = await fetch(VERSION_MANIFEST_URL, {
    cache: 'no-store',
    credentials: 'same-origin',
  });
  if (!response.ok) {
    throw new ServiceWorkerVersionError(`manifest_http_${response.status}`);
  }
  const manifest = await response.json();
  if (!isValidManifest(manifest)) {
    throw new ServiceWorkerVersionError('manifest_invalid');
  }
  return manifest;
}

function responseHasExpectedType(response, assetType) {
  const contentType = response.headers.get('Content-Type') || '';
  if (assetType === 'script') {
    return /javascript|ecmascript|text\/plain/i.test(contentType);
  }
  if (assetType === 'style') {
    return /text\/css/i.test(contentType);
  }
  return true;
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

async function verifyIntegrity(response, integrity) {
  if (!integrity || !integrity.startsWith('sha384-')) {
    return response;
  }
  if (!self.crypto?.subtle) {
    throw new ServiceWorkerVersionError('integrity_crypto_unavailable');
  }
  const expected = integrity.slice('sha384-'.length);
  const buffer = await response.clone().arrayBuffer();
  const digest = await self.crypto.subtle.digest('SHA-384', buffer);
  const actual = arrayBufferToBase64(digest);
  if (actual !== expected) {
    throw new ServiceWorkerVersionError('integrity_mismatch');
  }
  return response;
}

function isValidTradingViewAssetPath(file) {
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

function isValidTradingViewManifestVersion(version) {
  return (
    typeof version === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(version)
  );
}

function isValidTradingViewManifestPointer(manifest) {
  return (
    manifest?.schema === 1 &&
    isValidTradingViewManifestVersion(manifest.version) &&
    typeof manifest.baseUrl === 'string' &&
    Boolean(manifest.baseUrl) &&
    isValidTradingViewAssetPath(manifest.entry)
  );
}

function isValidTradingViewManifest(manifest) {
  if (
    isValidTradingViewManifestPointer(manifest) &&
    (manifest.styles === undefined ||
      (Array.isArray(manifest.styles) &&
        manifest.styles.every(isValidTradingViewAssetPath))) &&
    (manifest.bootstrapAssets === undefined ||
      (Array.isArray(manifest.bootstrapAssets) &&
        manifest.bootstrapAssets.every(isValidTradingViewAssetPath))) &&
    Array.isArray(manifest.assets) &&
    manifest.assets.every(
      (asset) =>
        isValidTradingViewAssetPath(asset?.file) &&
        typeof asset.integrity === 'string' &&
        asset.integrity.startsWith('sha384-') &&
        Number.isSafeInteger(asset.size) &&
        asset.size >= 0,
    )
  ) {
    const assetFiles = new Set(manifest.assets.map((asset) => asset.file));
    return (
      assetFiles.has(manifest.entry) &&
      (manifest.styles || []).every((file) => assetFiles.has(file)) &&
      (manifest.bootstrapAssets || []).every((file) =>
        assetFiles.has(file.replace('__LANG__', 'en')),
      )
    );
  }
  return false;
}

function areStringArraysEqual(left, right) {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function areTradingViewManifestsEqual(left, right) {
  return (
    isValidTradingViewManifest(left) &&
    isValidTradingViewManifest(right) &&
    left.schema === right.schema &&
    left.version === right.version &&
    left.baseUrl === right.baseUrl &&
    left.entry === right.entry &&
    areStringArraysEqual(left.styles || [], right.styles || []) &&
    areStringArraysEqual(
      left.bootstrapAssets || [],
      right.bootstrapAssets || [],
    ) &&
    left.assets.length === right.assets.length &&
    left.assets.every((asset, index) => {
      const otherAsset = right.assets[index];
      return (
        asset.file === otherAsset.file &&
        asset.integrity === otherAsset.integrity &&
        asset.size === otherAsset.size
      );
    })
  );
}

function getTradingViewCacheName(version) {
  return `${TRADINGVIEW_EMBED_CACHE_PREFIX}${version}`;
}

function normalizeTradingViewUrl(url, baseUrl = self.location.origin) {
  try {
    return new URL(url, baseUrl).toString();
  } catch {
    return '';
  }
}

function sortArrayCopy(items, compare) {
  return Reflect.apply(Array.prototype.sort, [...items], [compare]);
}

function reverseArrayCopy(items) {
  return Reflect.apply(Array.prototype.reverse, [...items], []);
}

function resolveTradingViewBaseUrl(manifest, manifestUrl) {
  const baseUrl = normalizeTradingViewUrl(manifest.baseUrl, manifestUrl);
  if (!baseUrl) {
    return '';
  }
  const url = new URL(baseUrl);
  if (url.origin !== new URL(manifestUrl).origin) {
    return '';
  }
  if (!url.pathname.endsWith('/')) {
    url.pathname = `${url.pathname}/`;
  }
  if (!LOCAL_HOSTNAMES.has(url.hostname)) {
    const pathParts = url.pathname.split('/').filter(Boolean);
    if (pathParts.at(-1) !== 'embed' || pathParts.at(-2) !== manifest.version) {
      return '';
    }
  }
  return url.toString();
}

function isTrustedTradingViewManifestUrl(manifestUrl) {
  try {
    const url = new URL(manifestUrl);
    const isLocal = LOCAL_HOSTNAMES.has(url.hostname);
    return isLocal
      ? url.protocol === 'http:' || url.protocol === 'https:'
      : url.protocol === 'https:' &&
          TRUSTED_TRADINGVIEW_MANIFEST_ORIGINS.has(url.origin);
  } catch {
    return false;
  }
}

function isTradingViewManifestRequestUrl(requestUrl) {
  if (!isTrustedTradingViewManifestUrl(requestUrl)) {
    return false;
  }
  return new URL(requestUrl).pathname.endsWith('/latest.json');
}

function getTradingViewAssetVersion(requestUrl) {
  if (!isTrustedTradingViewManifestUrl(requestUrl)) {
    return '';
  }
  const pathParts = new URL(requestUrl).pathname.split('/').filter(Boolean);
  const embedDirectoryIndex = pathParts.lastIndexOf('embed');
  if (
    embedDirectoryIndex <= 0 ||
    embedDirectoryIndex === pathParts.length - 1
  ) {
    return '';
  }
  const version = pathParts[embedDirectoryIndex - 1];
  return isValidTradingViewManifestVersion(version) ? version : '';
}

function isTradingViewAssetRequestUrl(requestUrl) {
  return Boolean(getTradingViewAssetVersion(requestUrl));
}

function resolveTradingViewAssetUrl(file, baseUrl) {
  if (!isValidTradingViewAssetPath(file)) {
    return undefined;
  }
  const normalizedBaseUrl = new URL(baseUrl);
  const assetUrl = new URL(file, normalizedBaseUrl);
  if (
    assetUrl.origin !== normalizedBaseUrl.origin ||
    !assetUrl.href.startsWith(normalizedBaseUrl.href)
  ) {
    return undefined;
  }
  return assetUrl;
}

let configuredTradingViewManifestUrl = normalizeTradingViewUrl(
  DEFAULT_TRADINGVIEW_EMBED_MANIFEST_URL,
);

function getTradingViewBaseUrlFromRequest(request) {
  const requestUrl = new URL(request.url).toString();
  const baseUrls = new Set(tradingViewManifestStates.keys());
  return (
    sortArrayCopy(
      [...baseUrls].filter(Boolean),
      (left, right) => right.length - left.length,
    ).find((baseUrl) => requestUrl.startsWith(baseUrl)) || ''
  );
}

async function fetchTradingViewManifest(manifestUrl) {
  const response = await fetch(manifestUrl, {
    cache: 'no-store',
    credentials: 'omit',
    mode: 'cors',
  });
  if (!response.ok || response.type === 'opaque') {
    throw new ServiceWorkerVersionError(
      `tradingview_manifest_http_${response.status}`,
    );
  }
  const manifestPointer = await response.clone().json();
  if (!isValidTradingViewManifestPointer(manifestPointer)) {
    throw new ServiceWorkerVersionError('tradingview_manifest_invalid');
  }
  const baseUrl = resolveTradingViewBaseUrl(manifestPointer, manifestUrl);
  if (!baseUrl) {
    throw new ServiceWorkerVersionError(
      'tradingview_manifest_base_url_invalid',
    );
  }
  let manifest = manifestPointer;
  let manifestResponse = response;
  if (!isValidTradingViewManifest(manifest)) {
    const versionManifestResponse = await fetch(
      new URL('embed-manifest.json', baseUrl),
      {
        cache: 'no-store',
        credentials: 'omit',
        mode: 'cors',
      },
    );
    if (
      !versionManifestResponse.ok ||
      versionManifestResponse.type === 'opaque'
    ) {
      throw new ServiceWorkerVersionError(
        `tradingview_version_manifest_http_${versionManifestResponse.status}`,
      );
    }
    manifest = await versionManifestResponse.json();
    if (
      !isValidTradingViewManifest(manifest) ||
      manifest.version !== manifestPointer.version ||
      manifest.baseUrl !== manifestPointer.baseUrl ||
      manifest.entry !== manifestPointer.entry
    ) {
      throw new ServiceWorkerVersionError(
        'tradingview_version_manifest_mismatch',
      );
    }
    manifestResponse = new Response(JSON.stringify(manifest), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
  tradingViewManifestStates.set(baseUrl, {
    cacheName: getTradingViewCacheName(manifest.version),
    manifest,
  });
  return { baseUrl, manifest, response: manifestResponse };
}

function createPinnedTradingViewManifest(manifest, manifestUrl) {
  if (!isValidTradingViewManifest(manifest)) {
    throw new ServiceWorkerVersionError('tradingview_manifest_invalid');
  }
  const baseUrl = resolveTradingViewBaseUrl(manifest, manifestUrl);
  if (!baseUrl) {
    throw new ServiceWorkerVersionError(
      'tradingview_manifest_base_url_invalid',
    );
  }
  tradingViewManifestStates.set(baseUrl, {
    cacheName: getTradingViewCacheName(manifest.version),
    manifest,
  });
  return {
    baseUrl,
    manifest,
    response: new Response(JSON.stringify(manifest), {
      headers: { 'Content-Type': 'application/json' },
    }),
  };
}

async function fetchPinnedTradingViewManifest(manifestUrl, expectedVersion) {
  if (
    !TRADINGVIEW_EMBED_BUILD_MANIFEST_URL ||
    !TRADINGVIEW_EMBED_BUILD_MANIFEST_INTEGRITY.startsWith('sha384-')
  ) {
    throw new ServiceWorkerVersionError('tradingview_manifest_not_pinned');
  }
  const response = await fetch(
    new URL(TRADINGVIEW_EMBED_BUILD_MANIFEST_URL, self.location.origin),
    {
      cache: 'force-cache',
      credentials: 'omit',
      integrity: TRADINGVIEW_EMBED_BUILD_MANIFEST_INTEGRITY,
      mode: 'cors',
      redirect: 'error',
    },
  );
  if (!response.ok || response.type === 'opaque') {
    throw new ServiceWorkerVersionError(
      `tradingview_manifest_http_${response.status}`,
    );
  }
  const manifest = await response.json();
  if (expectedVersion && manifest?.version !== expectedVersion) {
    throw new ServiceWorkerVersionError(
      'tradingview_manifest_version_mismatch',
    );
  }
  return createPinnedTradingViewManifest(manifest, manifestUrl);
}

async function getCompletedTradingViewManifest(manifestUrl) {
  const manifestRequest = new Request(manifestUrl);
  const cacheNames = (await caches.keys()).filter((cacheName) =>
    cacheName.startsWith(TRADINGVIEW_EMBED_CACHE_PREFIX),
  );
  for (const cacheName of reverseArrayCopy(cacheNames)) {
    const cache = await caches.open(cacheName);
    const response = await cache.match(manifestRequest);
    if (response) {
      const manifest = await response
        .clone()
        .json()
        .catch(() => null);
      if (isValidTradingViewManifest(manifest)) {
        const baseUrl = resolveTradingViewBaseUrl(manifest, manifestUrl);
        if (baseUrl) {
          tradingViewManifestStates.set(baseUrl, { cacheName, manifest });
          return response;
        }
      }
    }
  }
  return undefined;
}

async function restoreTradingViewManifestState(requestUrl) {
  const version = getTradingViewAssetVersion(requestUrl);
  if (!version) {
    return '';
  }
  const manifestUrl = new URL('/embed/latest.json', requestUrl).toString();
  const cache = await caches.open(getTradingViewCacheName(version));
  const cachedManifestResponse = await cache.match(new Request(manifestUrl));
  if (cachedManifestResponse) {
    const cachedManifest = await cachedManifestResponse
      .clone()
      .json()
      .catch(() => null);
    if (
      isValidTradingViewManifest(cachedManifest) &&
      cachedManifest.version === version
    ) {
      const baseUrl = resolveTradingViewBaseUrl(cachedManifest, manifestUrl);
      if (baseUrl && requestUrl.startsWith(baseUrl)) {
        tradingViewManifestStates.set(baseUrl, {
          cacheName: getTradingViewCacheName(version),
          manifest: cachedManifest,
        });
        return baseUrl;
      }
    }
  }
  if (TRADINGVIEW_EMBED_BUILD_MANIFEST_URL) {
    const { baseUrl } = await fetchPinnedTradingViewManifest(
      manifestUrl,
      version,
    );
    if (requestUrl.startsWith(baseUrl)) {
      return baseUrl;
    }
  }
  return '';
}

async function fetchTradingViewAsset(asset, baseUrl) {
  const assetUrl = resolveTradingViewAssetUrl(asset.file, baseUrl);
  if (!assetUrl) {
    throw new ServiceWorkerVersionError('tradingview_asset_origin_mismatch');
  }
  const response = await fetch(assetUrl, {
    cache: 'reload',
    credentials: 'omit',
    mode: 'cors',
    priority: 'low',
    redirect: 'error',
  });
  if (!response.ok || response.type === 'opaque') {
    throw new ServiceWorkerVersionError(
      `tradingview_asset_http_${response.status}`,
    );
  }
  return {
    request: new Request(assetUrl),
    response: await verifyIntegrity(response, asset.integrity),
  };
}

async function runConcurrent(items, concurrency, task) {
  let index = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (index < items.length) {
        const item = items[index];
        index += 1;
        await task(item);
      }
    },
  );
  await Promise.all(workers);
}

async function deleteOldTradingViewCaches(activeCacheName) {
  const cacheNames = (await caches.keys()).filter((cacheName) =>
    cacheName.startsWith(TRADINGVIEW_EMBED_CACHE_PREFIX),
  );
  const previousCacheNames = reverseArrayCopy(cacheNames)
    .filter((cacheName) => cacheName !== activeCacheName)
    .slice(0, PREVIOUS_VERSION_LIMIT);
  const retainedCacheNames = new Set([activeCacheName, ...previousCacheNames]);
  const deletedCacheNames = cacheNames.filter(
    (cacheName) => !retainedCacheNames.has(cacheName),
  );
  await Promise.all(
    deletedCacheNames.map((cacheName) => caches.delete(cacheName)),
  );
  const deletedCacheNameSet = new Set(deletedCacheNames);
  tradingViewManifestStates.forEach((state, baseUrl) => {
    if (deletedCacheNameSet.has(state.cacheName)) {
      tradingViewManifestStates.delete(baseUrl);
    }
  });
}

async function prefetchTradingViewEmbed(manifestUrl, expectedVersion) {
  const normalizedManifestUrl = normalizeTradingViewUrl(manifestUrl);
  if (
    !normalizedManifestUrl ||
    !isTrustedTradingViewManifestUrl(normalizedManifestUrl)
  ) {
    return;
  }
  configuredTradingViewManifestUrl = normalizedManifestUrl;
  const prefetchKey = `${normalizedManifestUrl}:${expectedVersion || 'local'}`;
  const existingPromise = tradingViewPrefetchPromises.get(prefetchKey);
  if (existingPromise) {
    return existingPromise;
  }

  const prefetchPromise = (async () => {
    let resolvedManifest;
    if (TRADINGVIEW_EMBED_BUILD_MANIFEST_URL) {
      resolvedManifest = await fetchPinnedTradingViewManifest(
        normalizedManifestUrl,
        expectedVersion,
      );
    } else if (LOCAL_HOSTNAMES.has(new URL(normalizedManifestUrl).hostname)) {
      resolvedManifest = await fetchTradingViewManifest(normalizedManifestUrl);
    } else {
      throw new ServiceWorkerVersionError('tradingview_manifest_not_pinned');
    }
    const { baseUrl, manifest, response: manifestResponse } = resolvedManifest;

    const cacheName = getTradingViewCacheName(manifest.version);
    let cache = await caches.open(cacheName);
    const manifestRequest = new Request(normalizedManifestUrl);
    const completedManifestResponse = await cache.match(manifestRequest);
    if (completedManifestResponse) {
      const completedManifest = await completedManifestResponse
        .json()
        .catch(() => null);
      if (areTradingViewManifestsEqual(completedManifest, manifest)) {
        await deleteOldTradingViewCaches(cacheName);
        return manifest.version;
      }
      await caches.delete(cacheName);
      cache = await caches.open(cacheName);
    }
    const priorityPatterns = [
      manifest.entry,
      ...(manifest.styles || []),
      'charting_library/charting_library.standalone.js',
      ...(manifest.bootstrapAssets || []),
    ];
    const getPriority = (file) =>
      priorityPatterns.reduce((priority, pattern) => {
        if (!pattern.includes('__LANG__')) {
          return pattern === file ? Math.max(priority, 2) : priority;
        }
        const [prefix, suffix] = pattern.split('__LANG__');
        return file.startsWith(prefix) && file.endsWith(suffix)
          ? Math.max(priority, 1)
          : priority;
      }, 0);
    const assets = sortArrayCopy(
      manifest.assets,
      (left, right) => getPriority(right.file) - getPriority(left.file),
    );

    await runConcurrent(
      assets,
      TRADINGVIEW_PREFETCH_CONCURRENCY,
      async (asset) => {
        const request = new Request(new URL(asset.file, baseUrl));
        if (await cache.match(request)) {
          return;
        }
        const fetched = await fetchTradingViewAsset(asset, baseUrl);
        await cache.put(fetched.request, fetched.response);
      },
    );
    // The cached manifest marks this version as complete. Keep it last so an
    // interrupted prefetch can never be mistaken for an offline-ready package.
    await cache.put(manifestRequest, manifestResponse);
    await deleteOldTradingViewCaches(cacheName);
    return manifest.version;
  })().finally(() => {
    tradingViewPrefetchPromises.delete(prefetchKey);
  });

  tradingViewPrefetchPromises.set(prefetchKey, prefetchPromise);
  return prefetchPromise;
}

async function handleTradingViewAssetRequest(request) {
  const normalizedRequestUrl = new URL(request.url).toString();
  if (isTradingViewManifestRequestUrl(normalizedRequestUrl)) {
    configuredTradingViewManifestUrl = normalizedRequestUrl;
    const completedManifest = await getCompletedTradingViewManifest(
      configuredTradingViewManifestUrl,
    );
    if (completedManifest) {
      return completedManifest;
    }
    try {
      if (
        LOCAL_HOSTNAMES.has(new URL(configuredTradingViewManifestUrl).hostname)
      ) {
        await prefetchTradingViewEmbed(configuredTradingViewManifestUrl);
      }
      const verifiedManifest = await getCompletedTradingViewManifest(
        configuredTradingViewManifestUrl,
      );
      if (verifiedManifest) {
        return verifiedManifest;
      }
      throw new ServiceWorkerVersionError('tradingview_manifest_unavailable');
    } catch {
      throw new ServiceWorkerVersionError('tradingview_manifest_unavailable');
    }
  }

  let baseUrl = getTradingViewBaseUrlFromRequest(request);
  if (!baseUrl && isTradingViewAssetRequestUrl(normalizedRequestUrl)) {
    baseUrl = await restoreTradingViewManifestState(normalizedRequestUrl);
  }
  if (!baseUrl) {
    return fetch(request);
  }

  const manifestState = tradingViewManifestStates.get(baseUrl);
  if (!manifestState) {
    return fetch(request, {
      cache: 'reload',
      credentials: 'omit',
      mode: 'cors',
    });
  }
  const cache = await caches.open(manifestState.cacheName);
  const cachedResponse = await cache.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  const requestUrl = normalizedRequestUrl;
  const asset = manifestState.manifest.assets.find((item) => {
    const assetUrl = resolveTradingViewAssetUrl(item.file, baseUrl);
    return assetUrl?.toString() === requestUrl;
  });
  if (!asset) {
    throw new ServiceWorkerVersionError('tradingview_asset_not_in_manifest');
  }
  const fetched = await fetchTradingViewAsset(asset, baseUrl);
  await cache.put(fetched.request, fetched.response.clone());
  return fetched.response;
}

async function fetchCriticalAsset(asset) {
  const response = await fetch(asset.url, {
    cache: 'reload',
    credentials: 'omit',
    mode: 'cors',
    redirect: 'error',
  });
  if (!response.ok || response.type === 'opaque') {
    throw new ServiceWorkerVersionError(`asset_http_${response.status}`);
  }
  if (!responseHasExpectedType(response, asset.as)) {
    throw new ServiceWorkerVersionError('asset_type_mismatch');
  }
  return verifyIntegrity(response, asset.integrity);
}

async function fetchCandidateHtml(manifest) {
  const response = await fetch(INDEX_HTML_URL, {
    cache: 'no-store',
    credentials: 'same-origin',
  });
  if (!response.ok) {
    throw new ServiceWorkerVersionError(`html_http_${response.status}`);
  }
  const html = await response.text();
  if (manifest.publicUrl !== '/' && !html.includes(manifest.publicUrl)) {
    throw new ServiceWorkerVersionError('html_manifest_mismatch');
  }
  return html;
}

function fetchNetworkHtml() {
  return fetch(INDEX_HTML_URL, {
    cache: 'no-store',
    credentials: 'same-origin',
  });
}

async function copyCacheEntries(sourceCacheName, targetCacheName) {
  const sourceCache = await caches.open(sourceCacheName);
  const targetCache = await caches.open(targetCacheName);
  const requests = await sourceCache.keys();
  await Promise.all(
    requests.map(async (request) => {
      const response = await sourceCache.match(request);
      if (response) {
        await targetCache.put(request, response);
      }
    }),
  );
}

function createStaticResourceCacheResponse(response) {
  const cachedResponse = response.clone();
  const headers = new Headers(cachedResponse.headers);
  headers.set(STATIC_RESOURCE_CACHE_TIME_HEADER, String(Date.now()));
  return new Response(cachedResponse.body, {
    status: cachedResponse.status,
    statusText: cachedResponse.statusText,
    headers,
  });
}

function getStaticResourceCacheTime(response) {
  const cacheTime = Number(
    response.headers.get(STATIC_RESOURCE_CACHE_TIME_HEADER),
  );
  if (Number.isFinite(cacheTime) && cacheTime > 0) {
    return cacheTime;
  }

  const responseTime = Date.parse(response.headers.get('Date') || '');
  return Number.isFinite(responseTime) ? responseTime : 0;
}

function isStaticResourceCacheFresh(response) {
  const cacheTime = getStaticResourceCacheTime(response);
  return cacheTime > 0 && Date.now() - cacheTime <= STATIC_RESOURCES_MAX_AGE_MS;
}

async function warmStaticResourceCache(cacheName) {
  const sourceCache = await caches.open(cacheName);
  const staticCache = await caches.open(STATIC_RESOURCES_CACHE);
  const requests = await sourceCache.keys();
  await Promise.all(
    requests.map(async (request) => {
      const response = await sourceCache.match(request);
      if (response) {
        await staticCache.put(
          request,
          createStaticResourceCacheResponse(response),
        );
      }
    }),
  );
}

async function trimCacheEntries(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const requests = await cache.keys();
  if (requests.length <= maxEntries) {
    return;
  }
  await Promise.all(
    requests
      .slice(0, requests.length - maxEntries)
      .map((request) => cache.delete(request)),
  );
}

async function writeVersionHtml(version, html) {
  const htmlCache = await caches.open(getHtmlCacheName(version));
  await htmlCache.put(
    INDEX_HTML_URL,
    new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    }),
  );
}

async function getCachedHtmlResponse(version) {
  if (!version) {
    return undefined;
  }
  const cache = await caches.open(getHtmlCacheName(version));
  return cache.match(INDEX_HTML_URL);
}

async function isVersionCacheValid(version, manifest) {
  if (
    !version ||
    !manifest ||
    manifest.version !== version ||
    !isValidManifest(manifest)
  ) {
    return false;
  }

  const htmlResponse = await getCachedHtmlResponse(version);
  if (!htmlResponse) {
    return false;
  }

  const criticalCache = await caches.open(getCriticalCacheName(version));
  for (const asset of manifest.critical) {
    const response = await criticalCache.match(asset.url);
    if (!response) {
      return false;
    }
  }

  return true;
}

async function isReadyVersionCacheValid(state) {
  return isVersionCacheValid(state.readyVersion, state.readyManifest);
}

async function clearReadyVersionState(
  state,
  lastError = 'ready_cache_missing',
) {
  const { readyVersion } = state;
  await deleteVersionCaches(readyVersion);

  const nextState = {
    ...state,
    readyVersion: '',
    readyManifest: undefined,
    lastError,
  };
  await writeVersionState(nextState);
  return nextState;
}

async function cacheVersionHtml(manifest) {
  const html = await fetchCandidateHtml(manifest);
  await writeVersionHtml(manifest.version, html);
}

async function prefetchVersion(manifest) {
  const tempCacheName = getCriticalTempCacheName(manifest.version);
  const finalCriticalCacheName = getCriticalCacheName(manifest.version);
  await caches.delete(tempCacheName);
  await caches.delete(finalCriticalCacheName);

  try {
    const html = await fetchCandidateHtml(manifest);
    const tempCache = await caches.open(tempCacheName);

    for (const asset of manifest.critical) {
      const response = await fetchCriticalAsset(asset);
      await tempCache.put(asset.url, response.clone());
    }

    await copyCacheEntries(tempCacheName, finalCriticalCacheName);
    await warmStaticResourceCache(finalCriticalCacheName);
    await caches.delete(tempCacheName);

    await writeVersionHtml(manifest.version, html);
  } catch (error) {
    await caches.delete(tempCacheName);
    await caches.delete(finalCriticalCacheName);
    throw error;
  }
}

async function switchActiveVersionState(state, manifest) {
  const previousVersions = [
    state.activeVersion,
    ...(state.previousVersions || []),
  ]
    .filter((version) => version && version !== manifest.version)
    .slice(0, PREVIOUS_VERSION_LIMIT);

  const nextState = {
    ...state,
    activeVersion: manifest.version,
    activeManifest: manifest,
    readyVersion: '',
    readyManifest: undefined,
    previousVersions,
    failedVersion: '',
    retryAt: 0,
    lastError: '',
  };
  await writeVersionState(nextState);
  await cleanupVersionCaches(nextState);
  await broadcastMessage(MESSAGE_TYPES.VERSION_ACTIVATED, {
    version: nextState.activeVersion,
  });
  return nextState;
}

async function resetActiveVersionState(state, lastError) {
  const nextState = {
    ...state,
    activeVersion: '',
    activeManifest: undefined,
    readyVersion: '',
    readyManifest: undefined,
    failedVersion: '',
    retryAt: 0,
    lastError,
  };
  await writeVersionState(nextState);
  return nextState;
}

async function rollbackToManifestVersionState(state, manifest) {
  let nextState = state;
  if (nextState.readyVersion && nextState.readyVersion !== manifest.version) {
    nextState = await clearReadyVersionState(nextState, 'version_rollback');
  }

  if (
    await isVersionCacheValid(manifest.version, manifest).catch(() => false)
  ) {
    return switchActiveVersionState(nextState, manifest);
  }

  try {
    await prefetchVersion(manifest);
    return switchActiveVersionState(nextState, manifest);
  } catch {
    return resetActiveVersionState(nextState, 'version_rollback_reset');
  }
}

function getNextRetryAt() {
  return Date.now() + 5 * 60 * 1000;
}

async function checkForVersionUpdate({ client } = {}) {
  if (versionCheckPromise) {
    return versionCheckPromise;
  }

  versionCheckPromise = (async () => {
    sendMessageToClient(client, MESSAGE_TYPES.UPDATE_CHECKING);
    let attemptedVersion = '';

    try {
      const manifest = await fetchVersionManifest();
      attemptedVersion = manifest.version;
      let state = await readVersionState();

      if (!state.activeVersion) {
        await cacheVersionHtml(manifest);
        const nextState = {
          ...state,
          activeVersion: manifest.version,
          activeManifest: manifest,
          lastError: '',
        };
        await writeVersionState(nextState);
        sendMessageToClient(client, MESSAGE_TYPES.VERSION_STATE, nextState);
        return nextState;
      }

      if (manifest.version === state.activeVersion) {
        if (state.readyVersion) {
          state = await clearReadyVersionState(state, 'version_rollback');
        }
        sendMessageToClient(client, MESSAGE_TYPES.VERSION_STATE, state);
        return state;
      }

      const isOlderThanActiveManifest = isManifestOlderThan(
        manifest,
        state.activeManifest,
      );
      if (isOlderThanActiveManifest) {
        const nextState = await rollbackToManifestVersionState(state, manifest);
        sendMessageToClient(client, MESSAGE_TYPES.VERSION_STATE, nextState);
        return nextState;
      }

      const isOlderThanReadyManifest = Boolean(
        state.readyVersion &&
        manifest.version !== state.readyVersion &&
        isManifestOlderThan(manifest, state.readyManifest),
      );
      const shouldClearVersionDowngradeBackoff =
        state.failedVersion === manifest.version &&
        state.lastError === 'version_downgrade';
      if (isOlderThanReadyManifest) {
        state = await clearReadyVersionState(state, 'ready_replaced');
        if (shouldClearVersionDowngradeBackoff) {
          state = {
            ...state,
            failedVersion: '',
            retryAt: 0,
          };
          await writeVersionState(state);
        }
      }

      if (manifest.version === state.readyVersion) {
        if (await isReadyVersionCacheValid(state)) {
          sendMessageToClient(client, MESSAGE_TYPES.VERSION_STATE, state);
          sendMessageToClient(client, MESSAGE_TYPES.UPDATE_READY, {
            version: state.readyVersion,
            manifest: state.readyManifest,
          });
          return state;
        }
        state = await clearReadyVersionState(state);
      }

      if (
        state.failedVersion === manifest.version &&
        state.retryAt &&
        Date.now() < state.retryAt &&
        state.lastError !== 'version_downgrade'
      ) {
        sendMessageToClient(client, MESSAGE_TYPES.VERSION_STATE, state);
        return state;
      }

      if (state.readyVersion && state.readyVersion !== manifest.version) {
        state = await clearReadyVersionState(state, 'ready_replaced');
      }

      await prefetchVersion(manifest);

      const nextState = {
        ...state,
        readyVersion: manifest.version,
        readyManifest: manifest,
        failedVersion: '',
        retryAt: 0,
        lastError: '',
      };
      await writeVersionState(nextState);
      await broadcastMessage(MESSAGE_TYPES.UPDATE_READY, {
        version: manifest.version,
        manifest,
      });
      return nextState;
    } catch (error) {
      const state = await readVersionState();
      const errorCode = getVersionErrorCode(error);
      const nextState = {
        ...state,
        failedVersion: attemptedVersion || state.failedVersion,
        retryAt: getNextRetryAt(),
        lastError: errorCode,
      };
      await writeVersionState(nextState);
      sendMessageToClient(client, MESSAGE_TYPES.UPDATE_FAILED, {
        errorCode: nextState.lastError,
      });
      return nextState;
    } finally {
      versionCheckPromise = null;
    }
  })();

  return versionCheckPromise;
}

async function promoteReadyVersionState(
  state,
  { shouldBroadcast = true } = {},
) {
  if (!state.readyVersion) {
    return state;
  }

  if (!(await isReadyVersionCacheValid(state))) {
    return clearReadyVersionState(state);
  }

  const previousVersions = [
    state.activeVersion,
    ...(state.previousVersions || []),
  ]
    .filter((version) => version && version !== state.readyVersion)
    .slice(0, PREVIOUS_VERSION_LIMIT);

  const nextState = {
    ...state,
    activeVersion: state.readyVersion,
    activeManifest: state.readyManifest,
    readyVersion: '',
    readyManifest: undefined,
    previousVersions,
    lastError: '',
  };
  await writeVersionState(nextState);
  await cleanupVersionCaches(nextState);
  if (shouldBroadcast) {
    await broadcastMessage(MESSAGE_TYPES.VERSION_ACTIVATED, {
      version: nextState.activeVersion,
    });
  }
  return nextState;
}

async function activateReadyVersion(version, { client } = {}) {
  const state = await readVersionState();
  if (!state.readyVersion || state.readyVersion !== version) {
    return state;
  }

  if (!(await isReadyVersionCacheValid(state))) {
    const nextState = await clearReadyVersionState(state);
    sendMessageToClient(client, MESSAGE_TYPES.UPDATE_FAILED, {
      errorCode: nextState.lastError,
    });
    await checkForVersionUpdate({ client });
    return nextState;
  }

  return promoteReadyVersionState(state);
}

async function cleanupVersionCaches(state) {
  const keepVersions = new Set(
    [
      state.activeVersion,
      state.readyVersion,
      ...(state.previousVersions || []),
    ].filter(Boolean),
  );
  const names = await caches.keys();
  await Promise.all(
    names.map(async (name) => {
      const isVersionCache =
        name.startsWith(HTML_CACHE_PREFIX) ||
        name.startsWith(CRITICAL_CACHE_PREFIX) ||
        name.startsWith(CRITICAL_TEMP_CACHE_PREFIX);
      if (!isVersionCache) {
        return;
      }
      const version = name.slice(name.indexOf(':') + 1);
      if (!keepVersions.has(version)) {
        await caches.delete(name);
      }
    }),
  );
}

async function handleNavigation() {
  const state = await readVersionState();

  const activeResponse = await getCachedHtmlResponse(state.activeVersion);
  if (activeResponse) {
    return activeResponse;
  }

  if (await isReadyVersionCacheValid(state).catch(() => false)) {
    const readyResponse = await getCachedHtmlResponse(state.readyVersion);
    if (readyResponse) {
      await promoteReadyVersionState(state, { shouldBroadcast: false }).catch(
        () => undefined,
      );
      return readyResponse;
    }
  }

  return fetchNetworkHtml();
}

async function getCriticalAssetResponse(request) {
  let state;
  try {
    state = await readVersionState();
  } catch {
    return undefined;
  }

  const versions = [
    state.activeVersion,
    state.readyVersion,
    ...(state.previousVersions || []),
  ].filter(Boolean);
  for (const version of new Set(versions)) {
    try {
      const cache = await caches.open(getCriticalCacheName(version));
      const response = await cache.match(request);
      if (response) {
        return response;
      }
    } catch {
      // Continue to the next version cache, then network fallback.
    }
  }
  return undefined;
}

function requestMatchesManifestPublicUrl(request, manifest) {
  if (!manifest?.publicUrl) {
    return false;
  }

  try {
    return request.url.startsWith(
      new URL(manifest.publicUrl, self.location.origin).toString(),
    );
  } catch {
    return false;
  }
}

async function recoverFromActiveAssetFailure(request) {
  const state = await readVersionState();
  if (
    !state.activeVersion ||
    !state.readyVersion ||
    !requestMatchesManifestPublicUrl(request, state.activeManifest)
  ) {
    return;
  }

  if (await isReadyVersionCacheValid(state)) {
    await promoteReadyVersionState(state);
  }
}

function scheduleStaticResourceCacheUpdate(event, cache, request, response) {
  if (!cache) {
    return;
  }
  const updatePromise = cache
    .put(request, createStaticResourceCacheResponse(response))
    .then(() =>
      trimCacheEntries(STATIC_RESOURCES_CACHE, STATIC_RESOURCES_MAX_ENTRIES),
    )
    .catch(() => {});
  event?.waitUntil(updatePromise);
}

async function handleScriptStyleRequest(request, event) {
  let staticCache;
  let staleStaticResponse;
  try {
    staticCache = await caches.open(STATIC_RESOURCES_CACHE);
    const staticResponse = await staticCache.match(request);
    if (staticResponse) {
      if (isStaticResourceCacheFresh(staticResponse)) {
        return staticResponse;
      }
      staleStaticResponse = staticResponse;
    }
  } catch {
    staticCache = undefined;
    staleStaticResponse = undefined;
  }

  const criticalResponse = await getCriticalAssetResponse(request);
  if (criticalResponse) {
    scheduleStaticResourceCacheUpdate(
      event,
      staticCache,
      request,
      criticalResponse,
    );
    return criticalResponse;
  }

  let networkResponse;
  try {
    networkResponse = await fetch(request);
  } catch (error) {
    if (staleStaticResponse) {
      return staleStaticResponse;
    }
    await recoverFromActiveAssetFailure(request).catch(() => {});
    throw error;
  }

  if (networkResponse.ok && staticCache) {
    scheduleStaticResourceCacheUpdate(
      event,
      staticCache,
      request,
      networkResponse,
    );
  } else if (!networkResponse.ok) {
    if (staleStaticResponse) {
      return staleStaticResponse;
    }
    await recoverFromActiveAssetFailure(request).catch(() => {});
  }
  return networkResponse;
}

self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    const navigationResponsePromise = handleNavigation().catch(() =>
      fetchNetworkHtml(),
    );
    event.respondWith(navigationResponsePromise);
    event.waitUntil(
      navigationResponsePromise
        .then(() => checkForVersionUpdate())
        .catch(() => undefined),
    );
  }
});

self.addEventListener('message', (event) => {
  const type = event.data?.type;
  const payload = event.data?.payload || {};
  const client = event.source;

  if (type === MESSAGE_TYPES.GET_VERSION_STATE) {
    event.waitUntil(
      readVersionState().then((state) => {
        sendMessageToClient(client, MESSAGE_TYPES.VERSION_STATE, state);
      }),
    );
    return;
  }

  if (type === MESSAGE_TYPES.CHECK_VERSION) {
    event.waitUntil(checkForVersionUpdate({ client }));
    return;
  }

  if (type === MESSAGE_TYPES.ACTIVATE_VERSION) {
    event.waitUntil(activateReadyVersion(payload.version, { client }));
    return;
  }

  if (type === MESSAGE_TYPES.PREFETCH_TRADINGVIEW_EMBED) {
    const replyPort = event.ports?.[0];
    event.waitUntil(
      prefetchTradingViewEmbed(
        payload.manifestUrl,
        payload.manifestVersion,
      ).then(
        (version) => replyPort?.postMessage({ ok: true, version }),
        (error) => {
          replyPort?.postMessage({
            error: getVersionErrorCode(error),
            ok: false,
          });
        },
      ),
    );
  }
});

registerRoute(
  ({ request }) =>
    isTradingViewManifestRequestUrl(new URL(request.url).toString()) ||
    isTradingViewAssetRequestUrl(new URL(request.url).toString()) ||
    Boolean(getTradingViewBaseUrlFromRequest(request)),
  ({ request }) => handleTradingViewAssetRequest(request),
);

// Static assets (images, fonts) -> CacheFirst with expiration
registerRoute(
  ({ request }) =>
    request.destination === 'image' || request.destination === 'font',
  new CacheFirst({
    cacheName: 'static-assets',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 500,
        maxAgeSeconds: 30 * 24 * 60 * 60,
      }),
    ],
  }),
);

// JS/CSS chunks -> CacheFirst.
// These assets are immutable: they are served from app-assets.onekey.so under a
// per-build path + contenthash filename, so a given URL's bytes never change
// (new content -> new URL). StaleWhileRevalidate would re-fetch every cached
// chunk in the background on each load — and because the asset host sends NO
// `Cache-Control: immutable`, that revalidation costs a real network round-trip
// for content that cannot have changed. CacheFirst serves from cache without
// revalidating. It is safe here: the asset host returns a genuine 404 (not an
// HTML fallback) for missing files, and CacheFirst caches only 200 responses, so
// a missing chunk is never pinned. Old build URLs fall out via expiration.
registerRoute(
  ({ request }) =>
    request.destination === 'script' || request.destination === 'style',
  ({ request, event }) => handleScriptStyleRequest(request, event),
);
