/* eslint-disable no-restricted-globals */
import { computeTradingViewEmbedIntegrity } from '@onekeyhq/shared/src/utils/tradingViewEmbedRelease';

const mockPinnedReleases = {};
const mockRegisteredRoutes = [];

jest.mock('@onekeyhq/shared/src/utils/tradingViewEmbedPinnedReleases', () => ({
  get TRADING_VIEW_EMBED_PINNED_RELEASES() {
    return mockPinnedReleases;
  },
}));
jest.mock('workbox-expiration', () => ({ ExpirationPlugin: jest.fn() }));
jest.mock('workbox-precaching', () => ({ precacheAndRoute: jest.fn() }));
jest.mock('workbox-routing', () => ({
  registerRoute: (match, handler) => {
    mockRegisteredRoutes.push({ handler, match });
  },
}));
jest.mock('workbox-strategies', () => ({ CacheFirst: jest.fn() }));

const ORIGIN = 'https://tradingview.onekeytest.com';
const VERSION = '1111111111111111111111111111111111111111';
const OTHER_VERSION = '2222222222222222222222222222222222222222';
const BASE_URL = `${ORIGIN}/${VERSION}/embed/`;
const MANIFEST_URL = `${BASE_URL}embed-manifest.json`;
const PINNED_CACHE_NAME = `onekey-tradingview-embed-pin-v1:${VERSION}`;
const LEGACY_CACHE_NAME = `onekey-tradingview-embed:${VERSION}`;
const PROXY_BASE_URL = `https://app.onekey.so/__onekey_tradingview_embed__/tradingview.onekeytest.com/${VERSION}/embed/`;
const ENTRY_FILE = 'onekey-tradingview-embed.js';
const ASSET_SOURCES = {
  [ENTRY_FILE]: 'export const chart = "pinned";',
  'charting_library/charting_library.standalone.js': 'window.TradingView = {};',
  'charting_library/bundles/en.hash.js': 'export const locale = "en";',
};
// Same length as the pinned entry, so only the digest can reject it.
const ATTACKER_SOURCE = 'export const chart = "attack";';

const encode = (text) => new TextEncoder().encode(text);

function toUrl(request) {
  return typeof request === 'string' ? request : request.url;
}

function createMemoryCache() {
  const entries = new Map();
  return {
    async match(request) {
      const entry = entries.get(toUrl(request));
      return entry ? new Response(entry.body, entry.init) : undefined;
    },
    async put(request, response) {
      entries.set(toUrl(request), {
        body: await response.arrayBuffer(),
        init: {
          headers: new Headers(response.headers),
          status: response.status,
          statusText: response.statusText,
        },
      });
    },
    async keys() {
      return [...entries.keys()].map((url) => new Request(url));
    },
    async delete(request) {
      return entries.delete(toUrl(request));
    },
  };
}

function createMemoryCacheStorage() {
  const stores = new Map();
  return {
    async open(cacheName) {
      if (!stores.has(cacheName)) {
        stores.set(cacheName, createMemoryCache());
      }
      return stores.get(cacheName);
    },
    async keys() {
      return [...stores.keys()];
    },
    async delete(cacheName) {
      return stores.delete(cacheName);
    },
  };
}

async function buildAsset(file, source) {
  return {
    file,
    integrity: await computeTradingViewEmbedIntegrity(encode(source)),
    size: encode(source).byteLength,
  };
}

async function buildManifest(sources = ASSET_SOURCES, version = VERSION) {
  return {
    schema: 2,
    version,
    baseUrl: `${ORIGIN}/${version}/embed/`,
    entry: ENTRY_FILE,
    bootstrap: {
      commonAssets: [
        ENTRY_FILE,
        'charting_library/charting_library.standalone.js',
      ],
      defaultLocale: 'en',
      localeAssets: { en: ['charting_library/bundles/en.hash.js'] },
    },
    assets: await Promise.all(
      Object.entries(sources).map(([file, source]) => buildAsset(file, source)),
    ),
  };
}

async function pinManifest(manifest) {
  const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
  mockPinnedReleases[ORIGIN] = {
    manifestIntegrity: await computeTradingViewEmbedIntegrity(
      encode(manifestText),
    ),
    version: manifest.version,
  };
  return manifestText;
}

function mockNetwork(responses) {
  const fetchMock = jest.fn(async (input) => {
    const body =
      responses[String(input instanceof Request ? input.url : input)];
    return body === undefined
      ? new Response('missing', { status: 404 })
      : new Response(body, { status: 200 });
  });
  globalThis.fetch = fetchMock;
  return fetchMock;
}

function releaseResponses(manifestText, sources = ASSET_SOURCES) {
  return {
    [MANIFEST_URL]: manifestText,
    ...Object.fromEntries(
      Object.entries(sources).map(([file, source]) => [
        `${BASE_URL}${file}`,
        source,
      ]),
    ),
  };
}

function loadServiceWorker(cacheStorage = createMemoryCacheStorage()) {
  const listeners = {};
  globalThis.self = {
    __WB_MANIFEST: [],
    addEventListener: (type, listener) => {
      listeners[type] = listener;
    },
    clients: {
      claim: jest.fn(() => Promise.resolve()),
      matchAll: jest.fn(() => Promise.resolve([])),
    },
    location: new URL('https://app.onekey.so/'),
    skipWaiting: jest.fn(() => Promise.resolve()),
  };
  globalThis.caches = cacheStorage;
  mockRegisteredRoutes.length = 0;
  jest.isolateModules(() => {
    require('./service-worker');
  });
  const [tradingViewRoute] = mockRegisteredRoutes;
  return {
    cacheStorage,
    handle: (url) => tradingViewRoute.handler({ request: new Request(url) }),
    matches: (url) => tradingViewRoute.match({ request: new Request(url) }),
    async postMessage(data) {
      const reply = jest.fn();
      const pending = [];
      listeners.message({
        data,
        ports: [{ postMessage: reply }],
        waitUntil: (promise) => pending.push(promise),
      });
      await Promise.all(pending);
      return reply.mock.calls[0]?.[0];
    },
  };
}

function prefetchMessage(manifest, manifestUrl = MANIFEST_URL) {
  return {
    type: 'PREFETCH_TRADINGVIEW_EMBED',
    payload: {
      locale: 'en',
      manifest,
      manifestUrl,
      manifestVersion: manifest.version,
    },
  };
}

describe('service worker TradingView release pinning', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    Object.keys(mockPinnedReleases).forEach((origin) => {
      delete mockPinnedReleases[origin];
    });
    globalThis.fetch = originalFetch;
    delete globalThis.self;
    delete globalThis.caches;
  });

  test('never trusts the mutable latest.json of a remote host', async () => {
    const manifest = await buildManifest();
    await pinManifest(manifest);
    const fetchMock = mockNetwork({});
    const serviceWorker = loadServiceWorker();

    expect(serviceWorker.matches(`${ORIGIN}/embed/latest.json`)).toBe(false);
    await expect(
      serviceWorker.postMessage(
        prefetchMessage(manifest, `${ORIGIN}/embed/latest.json`),
      ),
    ).resolves.toEqual({ error: 'tradingview_manifest_not_pinned', ok: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('serves the pinned manifest bytes and verified assets through the proxy', async () => {
    const manifest = await buildManifest();
    const manifestText = await pinManifest(manifest);
    const fetchMock = mockNetwork(releaseResponses(manifestText));
    const serviceWorker = loadServiceWorker();

    const manifestResponse = await serviceWorker.handle(MANIFEST_URL);
    await expect(manifestResponse.text()).resolves.toBe(manifestText);
    await expect(
      serviceWorker.postMessage(prefetchMessage(manifest)),
    ).resolves.toEqual({ ok: true, version: VERSION });
    const entryResponse = await serviceWorker.handle(
      `${PROXY_BASE_URL}${ENTRY_FILE}`,
    );
    await expect(entryResponse.text()).resolves.toBe(ASSET_SOURCES[ENTRY_FILE]);
    expect(
      fetchMock.mock.calls.filter(([input]) => String(input) === MANIFEST_URL),
    ).toHaveLength(1);
  });

  test('refuses a manifest swapped on the chart host, even when the page provides it', async () => {
    const pinnedManifest = await buildManifest();
    await pinManifest(pinnedManifest);
    const attackerSources = { ...ASSET_SOURCES, [ENTRY_FILE]: ATTACKER_SOURCE };
    const attackerManifest = await buildManifest(attackerSources);
    const fetchMock = mockNetwork(
      releaseResponses(
        `${JSON.stringify(attackerManifest, null, 2)}\n`,
        attackerSources,
      ),
    );
    const serviceWorker = loadServiceWorker();

    await expect(
      serviceWorker.postMessage(prefetchMessage(attackerManifest)),
    ).resolves.toEqual({
      error: 'tradingview_manifest_integrity_mismatch',
      ok: false,
    });
    await expect(serviceWorker.handle(MANIFEST_URL)).rejects.toMatchObject({
      code: 'tradingview_manifest_unavailable',
    });
    await expect(
      serviceWorker.handle(`${PROXY_BASE_URL}${ENTRY_FILE}`),
    ).rejects.toMatchObject({ code: 'tradingview_proxy_asset_unavailable' });
    expect(fetchMock).not.toHaveBeenCalledWith(
      `${BASE_URL}${ENTRY_FILE}`,
      expect.anything(),
    );
  });

  test('refuses an asset swapped on the chart host', async () => {
    const manifest = await buildManifest();
    const manifestText = await pinManifest(manifest);
    mockNetwork(
      releaseResponses(manifestText, {
        ...ASSET_SOURCES,
        [ENTRY_FILE]: ATTACKER_SOURCE,
      }),
    );
    const serviceWorker = loadServiceWorker();

    await expect(
      serviceWorker.postMessage(prefetchMessage(manifest)),
    ).resolves.toEqual({ error: 'integrity_mismatch', ok: false });
    await expect(
      serviceWorker.handle(`${PROXY_BASE_URL}${ENTRY_FILE}`),
    ).rejects.toMatchObject({ code: 'integrity_mismatch' });
  });

  test('does not serve other releases of a pinned host', async () => {
    await pinManifest(await buildManifest());
    const otherManifest = await buildManifest(ASSET_SOURCES, OTHER_VERSION);
    mockNetwork({});
    const serviceWorker = loadServiceWorker();

    await expect(
      serviceWorker.postMessage(
        prefetchMessage(
          otherManifest,
          `${ORIGIN}/${OTHER_VERSION}/embed/embed-manifest.json`,
        ),
      ),
    ).resolves.toEqual({ error: 'tradingview_manifest_not_pinned', ok: false });
    await expect(
      serviceWorker.handle(
        `https://app.onekey.so/__onekey_tradingview_embed__/tradingview.onekeytest.com/${OTHER_VERSION}/embed/${ENTRY_FILE}`,
      ),
    ).rejects.toMatchObject({ code: 'tradingview_proxy_asset_unavailable' });
  });

  test('re-verifies the cached manifest after a worker restart', async () => {
    const manifest = await buildManifest();
    const manifestText = await pinManifest(manifest);
    mockNetwork(releaseResponses(manifestText));
    const cacheStorage = createMemoryCacheStorage();
    await expect(
      loadServiceWorker(cacheStorage).postMessage(prefetchMessage(manifest)),
    ).resolves.toEqual({ ok: true, version: VERSION });

    mockNetwork({});
    const restarted = loadServiceWorker(cacheStorage);
    const entryResponse = await restarted.handle(
      `${PROXY_BASE_URL}${ENTRY_FILE}`,
    );
    await expect(entryResponse.text()).resolves.toBe(ASSET_SOURCES[ENTRY_FILE]);

    const cache = await cacheStorage.open(PINNED_CACHE_NAME);
    const tamperedManifestText = manifestText.replace(
      manifest.assets[0].integrity,
      (await buildAsset(ENTRY_FILE, ATTACKER_SOURCE)).integrity,
    );
    await cache.put(
      `${MANIFEST_URL}?__onekey_tradingview_recovery_manifest__=1`,
      new Response(tamperedManifestText),
    );
    await expect(
      loadServiceWorker(cacheStorage).handle(`${PROXY_BASE_URL}${ENTRY_FILE}`),
    ).rejects.toMatchObject({ code: 'tradingview_proxy_asset_unavailable' });
  });

  test('does not serve assets left in the pre-pin cache namespace', async () => {
    const manifest = await buildManifest();
    const manifestText = await pinManifest(manifest);
    const cacheStorage = createMemoryCacheStorage();
    const legacyCache = await cacheStorage.open(LEGACY_CACHE_NAME);
    await legacyCache.put(
      `${BASE_URL}${ENTRY_FILE}`,
      new Response(ATTACKER_SOURCE),
    );
    await legacyCache.put(
      `${ORIGIN}/embed/latest.json`,
      new Response(manifestText),
    );
    mockNetwork(releaseResponses(manifestText));
    const serviceWorker = loadServiceWorker(cacheStorage);

    await expect(
      serviceWorker.postMessage(prefetchMessage(manifest)),
    ).resolves.toEqual({ ok: true, version: VERSION });
    const entryResponse = await serviceWorker.handle(
      `${PROXY_BASE_URL}${ENTRY_FILE}`,
    );

    await expect(entryResponse.text()).resolves.toBe(ASSET_SOURCES[ENTRY_FILE]);
    await expect(cacheStorage.keys()).resolves.toEqual([PINNED_CACHE_NAME]);
  });

  test('keeps accepting page-provided manifests from a local dev server', async () => {
    const localBaseUrl = 'http://localhost:5173/';
    const manifest = {
      ...(await buildManifest()),
      baseUrl: localBaseUrl,
      version: 'local-dev',
    };
    mockNetwork(
      Object.fromEntries(
        Object.entries(ASSET_SOURCES).map(([file, source]) => [
          `${localBaseUrl}${file}`,
          source,
        ]),
      ),
    );
    const serviceWorker = loadServiceWorker();

    await expect(
      serviceWorker.postMessage(
        prefetchMessage(manifest, `${localBaseUrl}latest.json`),
      ),
    ).resolves.toEqual({ ok: true, version: 'local-dev' });
  });
});
