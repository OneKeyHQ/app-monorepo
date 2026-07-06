/* eslint-disable no-restricted-globals */
/* eslint-disable unicorn/prefer-global-this */
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

const MESSAGE_TYPES = {
  GET_VERSION_STATE: 'GET_VERSION_STATE',
  CHECK_VERSION: 'CHECK_VERSION',
  ACTIVATE_VERSION: 'ACTIVATE_VERSION',
  VERSION_STATE: 'VERSION_STATE',
  UPDATE_CHECKING: 'UPDATE_CHECKING',
  UPDATE_READY: 'UPDATE_READY',
  UPDATE_FAILED: 'UPDATE_FAILED',
  VERSION_ACTIVATED: 'VERSION_ACTIVATED',
};

let versionCheckPromise = null;

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
  }
});

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
