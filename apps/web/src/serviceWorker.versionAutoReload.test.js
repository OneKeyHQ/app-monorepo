/* eslint-disable no-restricted-globals */
import React from 'react';

import { computeTradingViewEmbedIntegrity } from '@onekeyhq/shared/src/utils/tradingViewEmbedRelease';

const mockRegisteredRoutes = [];
const mockAppRenderImpl = () => null;
const mockRegisterRootComponent = jest.fn();

jest.mock('@onekeyhq/shared/src/polyfills', () => ({}));
jest.mock('@onekeyhq/shared/src/performance/init', () => ({
  debugLandingLog: jest.fn(),
}));
jest.mock('@onekeyhq/kit-bg/src/hydration/hydrate', () => ({}));
jest.mock('@onekeyhq/shared/src/security/sesHarden/installWeb', () => ({}));
jest.mock('@onekeyhq/shared/src/locale', () => ({
  ETranslations: {
    global_refresh: 'global.refresh',
    global_unknown_error_retry_message: 'global.unknown_error_retry_message',
    settings_app_update_available: 'settings.app_update_available',
  },
}));
jest.mock('@onekeyhq/shared/src/locale/appLocale', () => ({
  appLocale: {
    intl: {
      formatMessage: ({ defaultMessage, id }) => defaultMessage || id,
    },
  },
}));
jest.mock('@onekeyhq/shared/src/locale/getDefaultLocale', () => ({
  getDefaultLocale: () => 'en-US',
}));
jest.mock('@onekeyhq/shared/src/locale/localeLoaders', () => ({
  LOCALE_KEYS: ['en-US'],
  loadLocaleMessages: () => Promise.resolve(),
}));
jest.mock('expo', () => ({
  registerRootComponent: (...args) => mockRegisterRootComponent(...args),
}));
jest.mock(
  '../App',
  () =>
    function MockApp() {
      return mockAppRenderImpl();
    },
);
jest.mock('@onekeyhq/shared/src/modules3rdParty/sentry', () => ({
  captureException: jest.fn(),
  initSentry: jest.fn(),
}));
jest.mock('workbox-expiration', () => ({ ExpirationPlugin: jest.fn() }));
jest.mock('workbox-precaching', () => ({ precacheAndRoute: jest.fn() }));
jest.mock('workbox-routing', () => ({
  registerRoute: (match, handler) => {
    mockRegisteredRoutes.push({ handler, match });
  },
}));
jest.mock('workbox-strategies', () => ({ CacheFirst: jest.fn() }));

const ORIGIN = 'https://app.onekey.so';
const V_OLD = '6640000000000000000000000000000000000000-100';
const V_NEW = '6700000000000000000000000000000000000000-200';
const V_NEXT = '6800000000000000000000000000000000000000-300';
const UNITAS_EMAIL_URL =
  'https://app.onekey.so/earn/bsc/XAUt/unitas?vault=0x0a4db0575ce1518ba1d008cf7cc08aeb05f57b0e&utm_source=onekey_email&utm_medium=email&utm_campaign=unitas_xaut_45d&utm_content=xaut_card_cta';

const encode = (text) => new TextEncoder().encode(text);

function toUrl(request) {
  if (typeof request === 'string') {
    return request.startsWith('http')
      ? request
      : new URL(request, ORIGIN).toString();
  }
  return request.url;
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
        body: await response.clone().arrayBuffer(),
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

async function createVersionBundle({
  version,
  buildTime,
  html,
  scriptUrl,
  scriptContent,
}) {
  const integrity = await computeTradingViewEmbedIntegrity(
    encode(scriptContent),
  );
  const manifest = {
    schema: 1,
    version,
    appVersion: '6.7.0',
    bundleVersion: '200',
    buildNumber: version.split('-')[1] || '0',
    commit: version.split('-')[0] || 'local',
    buildTime,
    publicUrl: '/',
    htmlUrl: '/index.html',
    generatedAt: new Date(buildTime).toISOString(),
    critical: [
      {
        url: scriptUrl,
        as: 'script',
        integrity,
        size: encode(scriptContent).byteLength,
      },
    ],
  };
  return {
    html,
    manifest,
    scriptContent,
    scriptUrl,
  };
}

function createServiceWorkerTestBed({
  cacheStorage = createMemoryCacheStorage(),
  serverBundle,
}) {
  const swListeners = {};
  const controlledClients = new Map();
  let currentServerBundle = serverBundle;

  globalThis.caches = cacheStorage;
  globalThis.fetch = jest.fn(async (input) => {
    const rawUrl = String(input instanceof Request ? input.url : input);
    const fullUrl = rawUrl.startsWith('http')
      ? rawUrl
      : new URL(rawUrl, ORIGIN).toString();
    const { pathname } = new URL(fullUrl);

    if (pathname === '/sw-version-manifest.json') {
      return new Response(JSON.stringify(currentServerBundle.manifest), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (pathname === '/index.html') {
      return new Response(currentServerBundle.html, {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }
    if (
      fullUrl === currentServerBundle.scriptUrl ||
      pathname === new URL(currentServerBundle.scriptUrl, ORIGIN).pathname
    ) {
      return new Response(currentServerBundle.scriptContent, {
        status: 200,
        headers: { 'Content-Type': 'application/javascript' },
      });
    }
    return new Response('not found', { status: 404 });
  });

  globalThis.self = {
    __WB_MANIFEST: [],
    addEventListener: (type, listener) => {
      swListeners[type] = listener;
    },
    clients: {
      claim: jest.fn(() => Promise.resolve()),
      matchAll: jest.fn(async () => [...controlledClients.values()]),
    },
    crypto: globalThis.crypto,
    location: new URL(`${ORIGIN}/service-worker.js`),
    skipWaiting: jest.fn(() => Promise.resolve()),
  };

  mockRegisteredRoutes.length = 0;
  jest.isolateModules(() => {
    require('./service-worker');
  });

  async function navigate(url) {
    let responsePromise;
    const waitUntilPromises = [];
    swListeners.fetch({
      request: {
        mode: 'navigate',
        url,
      },
      respondWith: (promise) => {
        responsePromise = promise;
      },
      waitUntil: (promise) => {
        waitUntilPromises.push(promise);
      },
    });
    const response = await responsePromise;
    const html = await response.text();
    await Promise.all(waitUntilPromises);
    return html;
  }

  async function sendFromClient(client, data) {
    const waitUntilPromises = [];
    swListeners.message({
      data,
      source: client,
      waitUntil: (promise) => {
        waitUntilPromises.push(promise);
      },
    });
    await Promise.all(waitUntilPromises);
  }

  return {
    cacheStorage,
    controlledClients,
    navigate,
    sendFromClient,
    setServerBundle(nextBundle) {
      currentServerBundle = nextBundle;
    },
  };
}

/**
 * Simulates an unmodified v6.6.4 legacy client (exact message protocol from
 * apps/web/index.js in v6.6.4 where pendingVersionActivation starts as '').
 */
function createLegacyV664Client({ id = 'client-v664', url, version = V_OLD }) {
  let pendingVersionActivation = '';
  const bannersShown = [];
  const reloadMock = jest.fn();

  const client = {
    id,
    url,
    bannersShown,
    reloadMock,
    postMessage(eventData) {
      const type = eventData?.type;
      const payload = eventData?.payload || {};

      if (type === 'UPDATE_READY') {
        if (payload.version && pendingVersionActivation !== payload.version) {
          bannersShown.push({ type: 'ready', version: payload.version });
        }
      }

      if (type === 'VERSION_STATE') {
        if (payload.activeVersion && payload.activeVersion !== version) {
          bannersShown.push({
            type: 'activated',
            version: payload.activeVersion,
          });
          return;
        }
        if (
          payload.readyVersion &&
          pendingVersionActivation !== payload.readyVersion
        ) {
          bannersShown.push({ type: 'ready', version: payload.readyVersion });
        }
      }

      if (type === 'VERSION_ACTIVATED') {
        const activatedVersion = payload.version;
        if (pendingVersionActivation === activatedVersion) {
          pendingVersionActivation = '';
          reloadMock();
          return;
        }
        if (activatedVersion && activatedVersion !== version) {
          bannersShown.push({ type: 'activated', version: activatedVersion });
        }
      }
    },
  };

  return client;
}

/**
 * Loads the real apps/web/index.js in a simulated browser DOM + ServiceWorker
 * environment and wires it directly to the ServiceWorker testBed.
 */
function createModernWebClientWithRealIndexJs({
  id = 'client-v670',
  testBed,
  url,
  version = V_NEW,
  initialSessionStorage = {},
}) {
  const [commitHash, buildNumber] = version.split('-');
  const prevNodeEnv = process.env.NODE_ENV;
  const prevSha = process.env.WORKFLOW_GITHUB_SHA;
  const prevBuild = process.env.BUILD_NUMBER;

  process.env.NODE_ENV = 'production';
  process.env.WORKFLOW_GITHUB_SHA = commitHash;
  process.env.BUILD_NUMBER = buildNumber;

  const windowListeners = {};
  const swContainerListeners = {};
  const storageMap = new Map(Object.entries(initialSessionStorage));
  const reloadMock = jest.fn();
  const pendingSwMessages = [];
  let bannerElement = null;

  const parsedUrl = new URL(url);

  const clientHandle = {
    id,
    url,
    reloadMock,
    storageMap,
    getBannerElement: () => bannerElement,
    postMessage(eventData) {
      const handlers = swContainerListeners.message || [];
      handlers.forEach((handler) => handler({ data: eventData }));
    },
  };

  testBed.controlledClients.set(id, clientHandle);

  const controller = {
    postMessage: (data) => {
      const promise = testBed.sendFromClient(clientHandle, data);
      pendingSwMessages.push(promise);
    },
  };

  const registration = {
    update: jest.fn(() => Promise.resolve()),
  };

  const fakeWindow = {
    addEventListener: (type, listener) => {
      if (!windowListeners[type]) {
        windowListeners[type] = [];
      }
      windowListeners[type].push(listener);
    },
    dispatchEvent: (event) => {
      const handlers = windowListeners[event.type] || [];
      handlers.forEach((handler) => handler(event));
    },
    location: {
      href: parsedUrl.toString(),
      origin: parsedUrl.origin,
      pathname: parsedUrl.pathname,
      search: parsedUrl.search,
      reload: reloadMock,
    },
    sessionStorage: {
      getItem: (key) => (storageMap.has(key) ? storageMap.get(key) : null),
      setItem: (key, val) => storageMap.set(key, String(val)),
    },
  };

  const fakeDocument = {
    readyState: 'complete',
    visibilityState: 'visible',
    addEventListener: jest.fn(),
    getElementById: (elId) =>
      elId === 'sw-update-banner' ? bannerElement : null,
    createElement: (tag) => ({
      tag,
      id: '',
      style: {},
      children: [],
      textContent: '',
      addEventListener: jest.fn(),
      append(...nodes) {
        this.children.push(...nodes);
      },
      remove() {
        if (bannerElement === this) {
          bannerElement = null;
        }
      },
    }),
    body: {
      appendChild(node) {
        if (node.id === 'sw-update-banner') {
          bannerElement = node;
        }
      },
    },
  };

  const fakeNavigator = {
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/128.0.0.0',
    serviceWorker: {
      controller,
      ready: Promise.resolve(registration),
      register: jest.fn(() => Promise.resolve(registration)),
      addEventListener: (type, listener) => {
        if (!swContainerListeners[type]) {
          swContainerListeners[type] = [];
        }
        swContainerListeners[type].push(listener);
      },
    },
  };

  fakeWindow.navigator = fakeNavigator;
  globalThis.window = fakeWindow;
  globalThis.document = fakeDocument;
  globalThis.navigator = fakeNavigator;
  globalThis.__onekeyWebRouteNotFound = false;

  mockRegisterRootComponent.mockReset();
  jest.isolateModules(() => {
    require('../index');
  });

  // Restore env vars after module evaluation
  process.env.NODE_ENV = prevNodeEnv;
  process.env.WORKFLOW_GITHUB_SHA = prevSha;
  process.env.BUILD_NUMBER = prevBuild;

  const RootAppComponent = mockRegisterRootComponent.mock.calls[0]?.[0];

  async function bootServiceWorkerProtocol() {
    const loadHandlers = windowListeners.load || [];
    loadHandlers.forEach((handler) => handler());
    // Flush microtasks for register().then(...) and ready.then(...)
    await Promise.resolve();
    await Promise.resolve();
    await flushSwMessages();
  }

  async function flushSwMessages() {
    while (pendingSwMessages.length > 0) {
      const batch = pendingSwMessages.splice(0, pendingSwMessages.length);
      await Promise.all(batch);
    }
  }

  async function triggerRootErrorBoundary(
    error = new Error('Unknown provider: unitas'),
  ) {
    const rootElement = RootAppComponent();
    const BoundaryClass = rootElement.type;
    const boundaryInstance = new BoundaryClass(rootElement.props);
    boundaryInstance.setState = (updater) => {
      Object.assign(
        boundaryInstance.state,
        typeof updater === 'function'
          ? updater(boundaryInstance.state)
          : updater,
      );
    };
    boundaryInstance.componentDidCatch(error);
    await flushSwMessages();
    return boundaryInstance;
  }

  async function triggerRouteNotFound() {
    globalThis.__onekeyWebRouteNotFound = true;
    fakeWindow.dispatchEvent(new Event('onekey-web-route-not-found'));
    await flushSwMessages();
  }

  return {
    bootServiceWorkerProtocol,
    clientHandle,
    flushSwMessages,
    reloadMock,
    storageMap,
    triggerRootErrorBoundary,
    triggerRouteNotFound,
  };
}

describe('Web Service Worker & Root ErrorBoundary auto-reload integration', () => {
  const originalFetch = globalThis.fetch;
  const originalCaches = globalThis.caches;
  const originalSelf = globalThis.self;
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;
  const originalNavigator = globalThis.navigator;

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    globalThis.fetch = originalFetch;
    globalThis.caches = originalCaches;
    globalThis.self = originalSelf;
    globalThis.window = originalWindow;
    globalThis.document = originalDocument;
    globalThis.navigator = originalNavigator;
    delete globalThis.__onekeyWebRouteNotFound;
    mockRegisterRootComponent.mockReset();
  });

  test('reproduces & verifies v6.6.4 legacy user opening v6.7.0 Unitas email link auto-reloads into v6.7.0', async () => {
    const bundleV664 = await createVersionBundle({
      version: V_OLD,
      buildTime: 1_700_000_000_000,
      html: '<!doctype html><html><body>v6.6.4</body></html>',
      scriptUrl: `${ORIGIN}/main.v664.js`,
      scriptContent: 'console.log("v6.6.4");',
    });
    const bundleV670 = await createVersionBundle({
      version: V_NEW,
      buildTime: 1_700_000_100_000,
      html: '<!doctype html><html><body>v6.7.0-unitas-ready</body></html>',
      scriptUrl: `${ORIGIN}/main.v670.js`,
      scriptContent: 'console.log("v6.7.0");',
    });

    const testBed = createServiceWorkerTestBed({ serverBundle: bundleV664 });

    // 1. Old user previously visited on v6.6.4, so v6.6.4 is cached as activeVersion.
    const initialHtml = await testBed.navigate(`${ORIGIN}/`);
    expect(initialHtml).toContain('v6.6.4');

    // 2. Server deploys release/v6.7.0 (with Unitas).
    testBed.setServerBundle(bundleV670);

    // 3. Old user clicks the Unitas email campaign link.
    // First navigation serves cached v6.6.4 HTML while SW checks for update.
    const firstVisitHtml = await testBed.navigate(UNITAS_EMAIL_URL);
    expect(firstVisitHtml).toContain('v6.6.4');

    // 4. The v6.6.4 client boots on the Unitas URL (crashes in EarnProtocolDetails)
    // and runs requestServiceWorkerVersionCheck() on load / controllerchange.
    const legacyClient = createLegacyV664Client({
      url: UNITAS_EMAIL_URL,
      version: V_OLD,
    });
    testBed.controlledClients.set(legacyClient.id, legacyClient);

    await testBed.sendFromClient(legacyClient, {
      type: 'GET_VERSION_STATE',
      payload: { clientVersion: V_OLD },
    });
    await testBed.sendFromClient(legacyClient, {
      type: 'CHECK_VERSION',
      payload: { clientVersion: V_OLD },
    });

    // 5. Expect the legacy client on the broken Unitas URL to have been
    // automatically reloaded once, and the reload navigation to serve v6.7.0 HTML!
    expect(legacyClient.reloadMock).toHaveBeenCalledTimes(1);
    const reloadedHtml = await testBed.navigate(UNITAS_EMAIL_URL);
    expect(reloadedHtml).toContain('v6.7.0-unitas-ready');
  });

  test('does NOT force-reload a legacy v6.6.4 client on a normal working route (e.g. /swap)', async () => {
    const bundleV664 = await createVersionBundle({
      version: V_OLD,
      buildTime: 1_700_000_000_000,
      html: '<!doctype html><html><body>v6.6.4</body></html>',
      scriptUrl: `${ORIGIN}/main.v664.js`,
      scriptContent: 'console.log("v6.6.4");',
    });
    const bundleV670 = await createVersionBundle({
      version: V_NEW,
      buildTime: 1_700_000_100_000,
      html: '<!doctype html><html><body>v6.7.0</body></html>',
      scriptUrl: `${ORIGIN}/main.v670.js`,
      scriptContent: 'console.log("v6.7.0");',
    });

    const testBed = createServiceWorkerTestBed({ serverBundle: bundleV664 });
    await testBed.navigate(`${ORIGIN}/swap`);

    testBed.setServerBundle(bundleV670);

    const legacySwapClient = createLegacyV664Client({
      url: `${ORIGIN}/swap`,
      version: V_OLD,
    });
    testBed.controlledClients.set(legacySwapClient.id, legacySwapClient);

    await testBed.sendFromClient(legacySwapClient, {
      type: 'CHECK_VERSION',
      payload: { clientVersion: V_OLD },
    });

    // Must NOT interrupt a normal page with a forced reload; shows banner instead.
    expect(legacySwapClient.reloadMock).not.toHaveBeenCalled();
    expect(legacySwapClient.bannersShown).toEqual([
      { type: 'ready', version: V_NEW },
    ]);
  });

  test('promotes already-ready version on top-level navigation / browser refresh', async () => {
    const bundleV664 = await createVersionBundle({
      version: V_OLD,
      buildTime: 1_700_000_000_000,
      html: '<!doctype html><html><body>v6.6.4</body></html>',
      scriptUrl: `${ORIGIN}/main.v664.js`,
      scriptContent: 'console.log("v6.6.4");',
    });
    const bundleV670 = await createVersionBundle({
      version: V_NEW,
      buildTime: 1_700_000_100_000,
      html: '<!doctype html><html><body>v6.7.0</body></html>',
      scriptUrl: `${ORIGIN}/main.v670.js`,
      scriptContent: 'console.log("v6.7.0");',
    });

    const testBed = createServiceWorkerTestBed({ serverBundle: bundleV664 });
    await testBed.navigate(`${ORIGIN}/`);

    // Background update prefetches v6.7.0 into readyVersion.
    testBed.setServerBundle(bundleV670);
    const normalClient = createLegacyV664Client({
      url: `${ORIGIN}/`,
      version: V_OLD,
    });
    testBed.controlledClients.set(normalClient.id, normalClient);
    await testBed.sendFromClient(normalClient, {
      type: 'CHECK_VERSION',
      payload: { clientVersion: V_OLD },
    });

    // When the user refreshes the browser or navigates to a new URL,
    // handleNavigation promotes readyVersion and serves v6.7.0 HTML.
    const refreshedHtml = await testBed.navigate(UNITAS_EMAIL_URL);
    expect(refreshedHtml).toContain('v6.7.0');
  });

  test('v6.7.0+ client auto-reloads when WebRootErrorBoundary catches an error and a new version is available', async () => {
    const bundleV670 = await createVersionBundle({
      version: V_NEW,
      buildTime: 1_700_000_100_000,
      html: '<!doctype html><html><body>v6.7.0</body></html>',
      scriptUrl: `${ORIGIN}/main.v670.js`,
      scriptContent: 'console.log("v6.7.0");',
    });
    const bundleV680 = await createVersionBundle({
      version: V_NEXT,
      buildTime: 1_700_000_200_000,
      html: '<!doctype html><html><body>v6.8.0-new-protocol</body></html>',
      scriptUrl: `${ORIGIN}/main.v680.js`,
      scriptContent: 'console.log("v6.8.0");',
    });

    const testBed = createServiceWorkerTestBed({ serverBundle: bundleV670 });
    await testBed.navigate(`${ORIGIN}/`);

    // Deploy v6.8.0 on server
    testBed.setServerBundle(bundleV680);

    const client = createModernWebClientWithRealIndexJs({
      testBed,
      url: `${ORIGIN}/earn/bsc/TOKEN/provider`,
      version: V_NEW,
    });

    // Page throws during initial render before SW finishes checking
    await client.triggerRootErrorBoundary(
      new Error('Unknown provider: provider'),
    );
    await client.bootServiceWorkerProtocol();

    expect(client.reloadMock).toHaveBeenCalledTimes(1);
    expect(client.clientHandle.getBannerElement()).toBeNull();
    const reloadedHtml = await testBed.navigate(
      `${ORIGIN}/earn/bsc/TOKEN/provider`,
    );
    expect(reloadedHtml).toContain('v6.8.0-new-protocol');
  });

  test('v6.7.0+ client auto-reloads on unmatched route (NotFound) and respects loop guard', async () => {
    const bundleV670 = await createVersionBundle({
      version: V_NEW,
      buildTime: 1_700_000_100_000,
      html: '<!doctype html><html><body>v6.7.0</body></html>',
      scriptUrl: `${ORIGIN}/main.v670.js`,
      scriptContent: 'console.log("v6.7.0");',
    });
    const bundleV680 = await createVersionBundle({
      version: V_NEXT,
      buildTime: 1_700_000_200_000,
      html: '<!doctype html><html><body>v6.8.0-new-route</body></html>',
      scriptUrl: `${ORIGIN}/main.v680.js`,
      scriptContent: 'console.log("v6.8.0");',
    });

    const testBed = createServiceWorkerTestBed({ serverBundle: bundleV670 });
    await testBed.navigate(`${ORIGIN}/`);
    testBed.setServerBundle(bundleV680);

    const routeUrl = `${ORIGIN}/new-campaign-v680?utm_source=email`;
    const client = createModernWebClientWithRealIndexJs({
      testBed,
      url: routeUrl,
      version: V_NEW,
    });

    // First, SW finishes checking while user is on a normal page -> shows banner
    await client.bootServiceWorkerProtocol();
    expect(client.reloadMock).not.toHaveBeenCalled();
    expect(client.clientHandle.getBannerElement()).not.toBeNull();

    // Now user navigates to an unmatched route -> immediately activates & reloads!
    await client.triggerRouteNotFound();
    expect(client.reloadMock).toHaveBeenCalledTimes(1);
    expect(client.clientHandle.getBannerElement()).toBeNull();
    expect(client.storageMap.get('__onekey_sw_error_auto_reload__')).toBe(
      `${V_NEXT}:/new-campaign-v680`,
    );

    // Loop guard: if the same version/pathname combination is already recorded in
    // sessionStorage, it must NOT auto-reload a second time.
    const guardedClient = createModernWebClientWithRealIndexJs({
      id: 'client-guarded',
      testBed,
      url: routeUrl,
      version: V_NEW,
      initialSessionStorage: {
        __onekey_sw_error_auto_reload__: `${V_NEXT}:/new-campaign-v680`,
      },
    });
    await guardedClient.bootServiceWorkerProtocol();
    await guardedClient.triggerRootErrorBoundary(new Error('Persistent error'));
    expect(guardedClient.reloadMock).not.toHaveBeenCalled();
  });
});
