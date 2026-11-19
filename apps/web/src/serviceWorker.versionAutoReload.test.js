/* eslint-disable no-restricted-globals */
import React from 'react';

import {
  clearWebRouteNotFoundState,
  syncWebRouteNotFoundState,
} from '@onekeyhq/kit/src/routes/config/webDappUrlFallback';
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
    let responsePromise = Promise.resolve(new Response(''));
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
  holdActivationRequests = false,
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
  const receivedWorkerMessages = [];
  let bannerElement = null;

  const parsedUrl = new URL(url);

  const clientHandle = {
    id,
    url,
    reloadMock,
    storageMap,
    getBannerElement: () => bannerElement,
    postMessage(eventData) {
      receivedWorkerMessages.push(eventData);
      const handlers = swContainerListeners.message || [];
      handlers.forEach((handler) => handler({ data: eventData }));
    },
  };

  testBed.controlledClients.set(id, clientHandle);

  const controller = {
    postMessage: jest.fn((data) => {
      if (holdActivationRequests && data.type === 'ACTIVATE_VERSION') {
        return;
      }
      const promise = testBed.sendFromClient(clientHandle, data);
      pendingSwMessages.push(promise);
    }),
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
  globalThis.addEventListener = fakeWindow.addEventListener;
  globalThis.location = fakeWindow.location;
  globalThis.sessionStorage = fakeWindow.sessionStorage;
  globalThis.dispatchEvent = fakeWindow.dispatchEvent;
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
    syncWebRouteNotFoundState({
      path: fakeWindow.location.pathname,
      state: { routes: [{ name: 'NotFound' }] },
    });
    await flushSwMessages();
  }

  async function recoverRoute() {
    const nextUrl = new URL('/swap', ORIGIN);
    clientHandle.url = nextUrl.href;
    fakeWindow.location.href = nextUrl.href;
    fakeWindow.location.pathname = nextUrl.pathname;
    fakeWindow.location.search = nextUrl.search;
    clearWebRouteNotFoundState();
    await flushSwMessages();
  }

  function clickRefresh() {
    const refreshButton = bannerElement.children[1];
    const clickHandler = refreshButton.addEventListener.mock.calls.find(
      ([type]) => type === 'click',
    )?.[1];
    clickHandler();
  }

  return {
    bootServiceWorkerProtocol,
    clickRefresh,
    clientHandle,
    flushSwMessages,
    recoverRoute,
    receivedWorkerMessages,
    reloadMock,
    sentMessages: controller.postMessage,
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
  const originalAddEventListener = globalThis.addEventListener;
  const originalDispatchEvent = globalThis.dispatchEvent;
  const originalLocation = globalThis.location;
  const originalSessionStorage = globalThis.sessionStorage;
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
    globalThis.addEventListener = originalAddEventListener;
    globalThis.dispatchEvent = originalDispatchEvent;
    globalThis.location = originalLocation;
    globalThis.sessionStorage = originalSessionStorage;
    globalThis.navigator = originalNavigator;
    delete globalThis.__onekeyWebRouteNotFound;
    delete globalThis.__onekeyWebUnmatchedPath;
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

  test('does NOT force-reload an already-current Earn tab that has not re-registered after a Service Worker restart', async () => {
    const bundleV670 = await createVersionBundle({
      version: V_NEW,
      buildTime: 1_700_000_100_000,
      html: '<!doctype html><html><body>v6.7.0</body></html>',
      scriptUrl: `${ORIGIN}/main.v670.js`,
      scriptContent: 'console.log("v6.7.0");',
    });

    const sharedCacheStorage = createMemoryCacheStorage();
    const initialWorker = createServiceWorkerTestBed({
      cacheStorage: sharedCacheStorage,
      serverBundle: bundleV670,
    });
    // Populate activeVersion = V_NEW and critical asset cache
    await initialWorker.navigate(UNITAS_EMAIL_URL);
    const cache = await sharedCacheStorage.open(`onekey-web-critical:${V_NEW}`);
    await cache.put(
      bundleV670.scriptUrl,
      new Response(bundleV670.scriptContent, {
        status: 200,
        headers: { 'Content-Type': 'application/javascript' },
      }),
    );

    // Simulate Service Worker termination and restart with empty in-memory clientRuntimeStates
    const restartedWorker = createServiceWorkerTestBed({
      cacheStorage: sharedCacheStorage,
      serverBundle: bundleV670,
    });

    const unreportedHealthyEarnTab = createLegacyV664Client({
      id: 'client-unreported-earn',
      url: UNITAS_EMAIL_URL,
      version: V_NEW,
    });
    const siblingSwapTab = createLegacyV664Client({
      id: 'client-sibling-swap',
      url: `${ORIGIN}/swap`,
      version: V_NEW,
    });
    restartedWorker.controlledClients.set(
      unreportedHealthyEarnTab.id,
      unreportedHealthyEarnTab,
    );
    restartedWorker.controlledClients.set(siblingSwapTab.id, siblingSwapTab);

    // Sibling tab triggers a version check before the Earn tab has sent any message to the restarted worker
    await restartedWorker.sendFromClient(siblingSwapTab, {
      type: 'CHECK_VERSION',
      payload: { clientVersion: V_NEW },
    });

    expect(unreportedHealthyEarnTab.reloadMock).not.toHaveBeenCalled();
  });

  test('does NOT auto-activate a readyVersion when concurrent CHECK_VERSION rolls it back to activeVersion', async () => {
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

    // Prefetch V_NEW into readyVersion while on a normal route
    testBed.setServerBundle(bundleV670);
    const normalClient = createLegacyV664Client({
      id: 'client-normal',
      url: `${ORIGIN}/swap`,
      version: V_OLD,
    });
    testBed.controlledClients.set(normalClient.id, normalClient);
    await testBed.sendFromClient(normalClient, {
      type: 'CHECK_VERSION',
      payload: { clientVersion: V_OLD },
    });

    // Server rolls back manifest to V_OLD
    testBed.setServerBundle(bundleV664);

    // Now an error client sends GET_VERSION_STATE and CHECK_VERSION concurrently
    const errorClient = createLegacyV664Client({
      id: 'client-rollback-race',
      url: UNITAS_EMAIL_URL,
      version: V_OLD,
    });
    testBed.controlledClients.set(errorClient.id, errorClient);

    await Promise.all([
      testBed.sendFromClient(errorClient, {
        type: 'GET_VERSION_STATE',
        payload: { clientVersion: V_OLD },
      }),
      testBed.sendFromClient(errorClient, {
        type: 'CHECK_VERSION',
        payload: { clientVersion: V_OLD },
      }),
    ]);

    expect(errorClient.reloadMock).not.toHaveBeenCalled();
    const stateCache = await testBed.cacheStorage.open(
      'onekey-web-version-state',
    );
    const stateResponse = await stateCache.match(
      `${ORIGIN}/__onekey_web_version_state__`,
    );
    const persistedState = await stateResponse.json();
    expect(persistedState.activeVersion).toBe(V_OLD);
    expect(persistedState.readyVersion).toBe('');
  });

  test('withdrawn readyVersion in VERSION_STATE is cleared and does not consume sessionStorage auto-reload quota', async () => {
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
      html: '<!doctype html><html><body>v6.8.0</body></html>',
      scriptUrl: `${ORIGIN}/main.v680.js`,
      scriptContent: 'console.log("v6.8.0");',
    });

    const testBed = createServiceWorkerTestBed({ serverBundle: bundleV670 });
    await testBed.navigate(`${ORIGIN}/`);
    testBed.setServerBundle(bundleV680);

    const client = createModernWebClientWithRealIndexJs({
      id: 'client-withdrawn-ready',
      testBed,
      url: `${ORIGIN}/earn/bsc/TOKEN/provider`,
      version: V_NEW,
    });

    // 1. First, V_NEXT becomes ready while page has no error -> banner shown
    await client.bootServiceWorkerProtocol();
    expect(client.clientHandle.getBannerElement()).not.toBeNull();
    expect(client.reloadMock).not.toHaveBeenCalled();

    // 2. Server rolls back to V_NEW and client receives VERSION_STATE with empty readyVersion
    testBed.setServerBundle(bundleV670);
    await testBed.sendFromClient(client.clientHandle, {
      type: 'CHECK_VERSION',
      payload: {
        clientVersion: V_NEW,
        clientAutoReloadCapable: true,
        hasPageError: false,
      },
    });
    expect(client.clientHandle.getBannerElement()).toBeNull();

    // 3. Page hits WebRootErrorBoundary while V_NEXT is withdrawn
    await client.triggerRootErrorBoundary(new Error('Render error'));
    expect(client.reloadMock).not.toHaveBeenCalled();
    expect(
      client.storageMap.get('__onekey_sw_error_auto_reload__'),
    ).toBeUndefined();

    // 4. V_NEXT is re-deployed and checked again -> auto-reload succeeds!
    testBed.setServerBundle(bundleV680);
    await testBed.sendFromClient(client.clientHandle, {
      type: 'CHECK_VERSION',
      payload: {
        clientVersion: V_NEW,
        clientAutoReloadCapable: true,
        hasPageError: true,
      },
    });
    expect(client.reloadMock).toHaveBeenCalledTimes(1);
    expect(client.storageMap.get('__onekey_sw_error_auto_reload__')).toBe(
      `${V_NEXT}:/earn/bsc/TOKEN/provider`,
    );
  });

  test('does NOT auto-reload when client recovers from NotFound back to a valid route before update becomes ready', async () => {
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
      html: '<!doctype html><html><body>v6.8.0</body></html>',
      scriptUrl: `${ORIGIN}/main.v680.js`,
      scriptContent: 'console.log("v6.8.0");',
    });

    const testBed = createServiceWorkerTestBed({ serverBundle: bundleV670 });
    await testBed.navigate(`${ORIGIN}/`);

    const client = createModernWebClientWithRealIndexJs({
      id: 'client-recovered-not-found',
      testBed,
      url: `${ORIGIN}/typo-route`,
      version: V_NEW,
    });

    // 1. Boot while still on V_NEW and hit NotFound (no update ready yet)
    await client.bootServiceWorkerProtocol();
    await client.triggerRouteNotFound();
    expect(client.reloadMock).not.toHaveBeenCalled();

    client.sentMessages.mockClear();
    await client.recoverRoute();
    expect(client.sentMessages.mock.calls).toEqual([
      [
        {
          type: 'REPORT_CLIENT_STATE',
          payload: {
            clientVersion: V_NEW,
            clientAutoReloadCapable: true,
            hasPageError: false,
          },
        },
      ],
    ]);

    // Another tab can check for an update without a message from the recovered page.
    testBed.setServerBundle(bundleV680);
    const sibling = createLegacyV664Client({
      id: 'sibling-client',
      url: `${ORIGIN}/swap`,
      version: V_NEW,
    });
    await testBed.sendFromClient(sibling, {
      type: 'CHECK_VERSION',
      payload: { clientVersion: V_NEW },
    });
    expect(client.receivedWorkerMessages).toContainEqual(
      expect.objectContaining({
        type: 'UPDATE_READY',
        payload: expect.objectContaining({ version: V_NEXT }),
      }),
    );
    expect(client.receivedWorkerMessages).not.toContainEqual(
      expect.objectContaining({ type: 'VERSION_ACTIVATED' }),
    );
    expect(client.reloadMock).not.toHaveBeenCalled();
    expect(client.clientHandle.getBannerElement()).not.toBeNull();

    // An automatic instruction already in flight must also honor the live state.
    client.clientHandle.postMessage({
      type: 'VERSION_ACTIVATED',
      payload: { version: V_NEXT, autoReload: true },
    });
    expect(client.reloadMock).not.toHaveBeenCalled();
    expect(client.storageMap.size).toBe(0);
    expect(client.clientHandle.getBannerElement()).not.toBeNull();
  });

  test.each(['confirmation', 'timeout'])(
    'checks live route state before reloading for an automatic activation %s',
    async (completion) => {
      const bundleV670 = await createVersionBundle({
        version: V_NEW,
        buildTime: 1_700_000_100_000,
        html: '<!doctype html><html><body>v6.7.0</body></html>',
        scriptUrl: `${ORIGIN}/main.v670.js`,
        scriptContent: 'console.log("v6.7.0");',
      });
      const testBed = createServiceWorkerTestBed({ serverBundle: bundleV670 });
      const client = createModernWebClientWithRealIndexJs({
        testBed,
        url: `${ORIGIN}/typo-route`,
        holdActivationRequests: true,
      });
      await client.bootServiceWorkerProtocol();
      await client.triggerRouteNotFound();
      client.clientHandle.postMessage({
        type: 'UPDATE_READY',
        payload: { version: V_NEXT },
      });
      expect(client.sentMessages).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ACTIVATE_VERSION',
          payload: expect.objectContaining({ version: V_NEXT }),
        }),
      );
      expect(client.clientHandle.getBannerElement()).toBeNull();

      // Exercise both completion guards independently of cancellation by the recovery event.
      globalThis.__onekeyWebRouteNotFound = false;
      if (completion === 'confirmation') {
        client.clientHandle.postMessage({
          type: 'VERSION_ACTIVATED',
          payload: { version: V_NEXT },
        });
      }
      jest.advanceTimersByTime(3000);
      expect(client.reloadMock).not.toHaveBeenCalled();
      expect(client.storageMap.size).toBe(0);
      expect(client.clientHandle.getBannerElement()).not.toBeNull();
    },
  );

  test('recovery restores Refresh and a stale automatic failure preserves a later manual request for the same version', async () => {
    const bundleV670 = await createVersionBundle({
      version: V_NEW,
      buildTime: 1_700_000_100_000,
      html: '<!doctype html><html><body>v6.7.0</body></html>',
      scriptUrl: `${ORIGIN}/main.v670.js`,
      scriptContent: 'console.log("v6.7.0");',
    });
    const testBed = createServiceWorkerTestBed({ serverBundle: bundleV670 });
    const client = createModernWebClientWithRealIndexJs({
      testBed,
      url: `${ORIGIN}/typo-route`,
      holdActivationRequests: true,
    });
    await client.bootServiceWorkerProtocol();
    await client.triggerRouteNotFound();
    client.clientHandle.postMessage({
      type: 'UPDATE_READY',
      payload: { version: V_NEXT },
    });
    const automaticRequest = client.sentMessages.mock.lastCall[0];
    expect(automaticRequest.type).toBe('ACTIVATE_VERSION');
    expect(client.clientHandle.getBannerElement()).toBeNull();

    await client.recoverRoute();
    expect(client.clientHandle.getBannerElement()).not.toBeNull();
    // The previous automatic timeout must expire before the manual request's timeout.
    jest.advanceTimersByTime(1000);
    client.clickRefresh();
    const manualRequest = client.sentMessages.mock.lastCall[0];
    expect(manualRequest.type).toBe('ACTIVATE_VERSION');
    expect(manualRequest.payload.requestId).not.toBe(
      automaticRequest.payload.requestId,
    );
    client.clientHandle.postMessage({
      type: 'UPDATE_FAILED',
      payload: {
        operation: 'ACTIVATE_VERSION',
        version: V_NEXT,
        requestId: automaticRequest.payload.requestId,
      },
    });
    jest.advanceTimersByTime(2000);
    expect(client.reloadMock).not.toHaveBeenCalled();

    client.clientHandle.postMessage({
      type: 'VERSION_ACTIVATED',
      payload: { version: V_NEXT },
    });
    jest.advanceTimersByTime(1000);
    expect(client.reloadMock).toHaveBeenCalledTimes(1);
    expect(client.storageMap.size).toBe(0);
  });

  test('a real CHECK_VERSION failure does not cancel a concurrent manual activation', async () => {
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
      html: '<!doctype html><html><body>v6.8.0</body></html>',
      scriptUrl: `${ORIGIN}/main.v680.js`,
      scriptContent: 'console.log("v6.8.0");',
    });
    const testBed = createServiceWorkerTestBed({ serverBundle: bundleV670 });
    await testBed.navigate(`${ORIGIN}/`);
    testBed.setServerBundle(bundleV680);
    const client = createModernWebClientWithRealIndexJs({
      testBed,
      url: `${ORIGIN}/swap`,
    });
    await client.bootServiceWorkerProtocol();
    expect(client.clientHandle.getBannerElement()).not.toBeNull();

    let completeManifestFetch;
    globalThis.fetch.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          completeManifestFetch = resolve;
        }),
    );
    const check = testBed.sendFromClient(client.clientHandle, {
      type: 'CHECK_VERSION',
      payload: { clientVersion: V_NEW },
    });
    client.clickRefresh();
    completeManifestFetch(new Response('', { status: 503 }));
    await check;
    await client.flushSwMessages();

    const results = client.receivedWorkerMessages.filter(
      ({ type }) => type === 'UPDATE_FAILED' || type === 'VERSION_ACTIVATED',
    );
    expect(results).toEqual([
      expect.objectContaining({
        type: 'UPDATE_FAILED',
        payload: expect.objectContaining({ operation: 'CHECK_VERSION' }),
      }),
      {
        type: 'VERSION_ACTIVATED',
        payload: { version: V_NEXT },
      },
    ]);
    expect(client.reloadMock).toHaveBeenCalledTimes(1);
  });

  test('a matching activation failure cancels the fallback and removes the invalid ready version from the banner', async () => {
    const bundleV670 = await createVersionBundle({
      version: V_NEW,
      buildTime: 1_700_000_100_000,
      html: '<!doctype html><html><body>v6.7.0</body></html>',
      scriptUrl: `${ORIGIN}/main.v670.js`,
      scriptContent: 'console.log("v6.7.0");',
    });
    const testBed = createServiceWorkerTestBed({ serverBundle: bundleV670 });
    const client = createModernWebClientWithRealIndexJs({
      testBed,
      url: `${ORIGIN}/swap`,
      holdActivationRequests: true,
    });
    await client.bootServiceWorkerProtocol();
    client.clientHandle.postMessage({
      type: 'UPDATE_READY',
      payload: { version: V_NEXT },
    });
    client.clickRefresh();
    const request = client.sentMessages.mock.lastCall[0];
    client.clientHandle.postMessage({
      type: 'UPDATE_FAILED',
      payload: {
        operation: 'ACTIVATE_VERSION',
        version: V_NEXT,
        requestId: request.payload.requestId,
      },
    });
    jest.advanceTimersByTime(3000);
    expect(client.reloadMock).not.toHaveBeenCalled();
    expect(client.clientHandle.getBannerElement()).toBeNull();
  });
});
