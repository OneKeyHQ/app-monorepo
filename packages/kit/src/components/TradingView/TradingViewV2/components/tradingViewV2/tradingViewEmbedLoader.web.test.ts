import { jest } from '@jest/globals';

import { TRADING_VIEW_EMBED_PINNED_RELEASES } from '@onekeyhq/shared/src/utils/tradingViewEmbedPinnedReleases';
import { computeTradingViewEmbedIntegrity } from '@onekeyhq/shared/src/utils/tradingViewEmbedRelease';
import { TRADING_VIEW_EMBED_SERVICE_WORKER_PATH } from '@onekeyhq/shared/src/utils/tradingViewEmbedServiceWorker';

import { preloadTradingViewEmbedBootstrapAssets } from './tradingViewEmbedLoader.web';

const serviceWorkerScriptUrl = new URL(
  TRADING_VIEW_EMBED_SERVICE_WORKER_PATH,
  'http://localhost',
).toString();

const TEST_ORIGIN = 'https://tradingview.onekeytest.com';

const buildAsset = (file: string) => ({
  file,
  integrity: 'sha384-dGVzdA==',
  size: 1,
});

const buildRemoteManifest = (version: string) => ({
  schema: 2,
  version,
  baseUrl: `${TEST_ORIGIN}/${version}/embed/`,
  entry: 'onekey-tradingview-embed.js',
  bootstrap: {
    commonAssets: [
      'onekey-tradingview-embed.js',
      'charting_library/charting_library.standalone.js',
    ],
    defaultLocale: 'en',
    localeAssets: {
      en: ['charting_library/bundles/en.hash.js'],
    },
  },
  assets: [
    buildAsset('onekey-tradingview-embed.js'),
    buildAsset('charting_library/charting_library.standalone.js'),
    buildAsset('charting_library/bundles/en.hash.js'),
  ],
});

async function pinRelease(
  origin: string,
  version: string,
  manifestText: string,
): Promise<string> {
  jest.replaceProperty(TRADING_VIEW_EMBED_PINNED_RELEASES, origin, {
    manifestIntegrity: await computeTradingViewEmbedIntegrity(
      new TextEncoder().encode(manifestText),
    ),
    version,
  });
  return `${origin}/${version}/embed/embed-manifest.json`;
}

function mockServiceWorkerController(version: string) {
  const postMessage = jest.fn(
    (message: { type?: string }, transfer: Transferable[] | undefined) => {
      const replyPort = transfer?.[0] as MessagePort | undefined;
      replyPort?.postMessage(
        message.type === 'GET_TRADINGVIEW_EMBED_PROTOCOL'
          ? { ok: true, protocol: 1 }
          : { ok: true, version },
      );
    },
  );
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      serviceWorker: {
        addEventListener: jest.fn(),
        controller: {
          postMessage,
          scriptURL: serviceWorkerScriptUrl,
        },
        ready: Promise.resolve({}),
        register: jest.fn(),
        removeEventListener: jest.fn(),
      },
    },
  });
  return postMessage;
}

describe('preloadTradingViewEmbedBootstrapAssets', () => {
  const initialNavigatorDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    'navigator',
  );

  afterEach(() => {
    if (initialNavigatorDescriptor) {
      Object.defineProperty(
        globalThis,
        'navigator',
        initialNavigatorDescriptor,
      );
    } else {
      Reflect.deleteProperty(globalThis, 'navigator');
    }
    jest.restoreAllMocks();
  });

  test('preloads the localized TradingView bootstrap assets', async () => {
    const manifest = {
      schema: 2,
      version: 'test-v1',
      baseUrl: 'http://localhost:5173/',
      entry: 'onekey-tradingview-embed.js',
      bootstrap: {
        commonAssets: [
          'onekey-tradingview-embed.js',
          'charting_library/charting_library.standalone.js',
          'charting_library/bundles/runtime.hash.js',
          'charting_library/bundles/library.hash.js',
        ],
        defaultLocale: 'en',
        localeAssets: {
          en: ['charting_library/bundles/en.hash.js'],
          zh: ['charting_library/bundles/zh.hash.js'],
        },
      },
      assets: [
        buildAsset('onekey-tradingview-embed.js'),
        buildAsset('charting_library/charting_library.standalone.js'),
        buildAsset('charting_library/bundles/runtime.hash.js'),
        buildAsset('charting_library/bundles/en.hash.js'),
        buildAsset('charting_library/bundles/zh.hash.js'),
        buildAsset('charting_library/bundles/library.hash.js'),
      ],
    };
    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify(manifest), {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        }),
      )
      .mockImplementation(async () => new Response('asset', { status: 200 }));

    await preloadTradingViewEmbedBootstrapAssets(
      'http://localhost:5173/?locale=zh-CN',
    );

    const fetchCalls = fetchMock.mock.calls as unknown as [
      RequestInfo | URL,
      RequestInit?,
    ][];
    expect(fetchMock).toHaveBeenCalledTimes(6);
    expect(fetchCalls[0][1]).toEqual(
      expect.objectContaining({ cache: 'no-store', credentials: 'omit' }),
    );
    expect(fetchCalls.slice(1).map(([input]) => input.toString())).toEqual(
      expect.arrayContaining([
        'http://localhost:5173/charting_library/bundles/runtime.hash.js',
        'http://localhost:5173/charting_library/bundles/zh.hash.js',
        'http://localhost:5173/charting_library/bundles/library.hash.js',
        'http://localhost:5173/charting_library/charting_library.standalone.js',
        'http://localhost:5173/onekey-tradingview-embed.js',
      ]),
    );
    expect(fetchCalls.slice(1).map(([, init]) => init)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          cache: 'force-cache',
          credentials: 'omit',
          integrity: 'sha384-dGVzdA==',
          mode: 'cors',
        }),
      ]),
    );
  });

  test('falls back to the English locale asset', async () => {
    const manifest = {
      schema: 2,
      version: 'test-v2',
      baseUrl: 'http://127.0.0.1:5173/',
      entry: 'onekey-tradingview-embed.js',
      bootstrap: {
        commonAssets: [
          'onekey-tradingview-embed.js',
          'charting_library/charting_library.standalone.js',
        ],
        defaultLocale: 'en',
        localeAssets: {
          en: ['charting_library/bundles/en.hash.js'],
          fr: ['charting_library/bundles/fr.hash.js'],
        },
      },
      assets: [
        buildAsset('onekey-tradingview-embed.js'),
        buildAsset('charting_library/charting_library.standalone.js'),
        buildAsset('charting_library/bundles/en.hash.js'),
        buildAsset('charting_library/bundles/fr.hash.js'),
      ],
    };
    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify(manifest), {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        }),
      )
      .mockImplementation(async () => new Response('asset', { status: 200 }));

    await preloadTradingViewEmbedBootstrapAssets(
      'http://127.0.0.1:5173/?locale=unsupported',
    );

    expect(fetchMock).toHaveBeenLastCalledWith(
      new URL('http://127.0.0.1:5173/charting_library/bundles/en.hash.js'),
      expect.objectContaining({ cache: 'force-cache' }),
    );
  });

  test('keeps schema v1 bootstrap manifests compatible during rollout', async () => {
    const manifest = {
      schema: 1,
      version: 'legacy-v1',
      baseUrl: 'http://localhost:5174/',
      entry: 'onekey-tradingview-embed.js',
      bootstrapAssets: ['charting_library/bundles/__LANG__.hash.js'],
      assets: [
        buildAsset('onekey-tradingview-embed.js'),
        buildAsset('charting_library/bundles/en.hash.js'),
        buildAsset('charting_library/bundles/zh.hash.js'),
      ],
    };
    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify(manifest), { status: 200 }),
      )
      .mockImplementation(async () => new Response('asset', { status: 200 }));

    await preloadTradingViewEmbedBootstrapAssets(
      'http://localhost:5174/?locale=zh-CN',
    );

    expect(fetchMock).toHaveBeenLastCalledWith(
      new URL('http://localhost:5174/charting_library/bundles/zh.hash.js'),
      expect.objectContaining({ integrity: 'sha384-dGVzdA==' }),
    );
  });

  test('resolves a lightweight latest pointer to its version manifest', async () => {
    const manifestPointer = {
      schema: 2,
      version: 'test-pointer-v1',
      baseUrl: 'http://localhost:5190/test-pointer-v1/embed/',
      entry: 'onekey-tradingview-embed.js',
    };
    const versionManifest = {
      ...manifestPointer,
      bootstrap: {
        commonAssets: [
          'onekey-tradingview-embed.js',
          'charting_library/charting_library.standalone.js',
        ],
        defaultLocale: 'en',
        localeAssets: {
          en: ['charting_library/bundles/en.hash.js'],
        },
      },
      assets: [
        buildAsset('onekey-tradingview-embed.js'),
        buildAsset('charting_library/charting_library.standalone.js'),
        buildAsset('charting_library/bundles/en.hash.js'),
      ],
    };
    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify(manifestPointer), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(versionManifest), { status: 200 }),
      )
      .mockImplementation(async () => new Response('asset', { status: 200 }));

    await preloadTradingViewEmbedBootstrapAssets(
      'http://localhost:5190/?locale=en',
    );

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      new URL(
        'http://localhost:5190/test-pointer-v1/embed/embed-manifest.json',
      ),
      {
        cache: 'no-store',
        credentials: 'omit',
        mode: 'cors',
        redirect: 'error',
      },
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      new URL(
        'http://localhost:5190/test-pointer-v1/embed/charting_library/bundles/en.hash.js',
      ),
      expect.objectContaining({ integrity: 'sha384-dGVzdA==' }),
    );
  });

  test.each([
    'https://evil.example/onekey-tradingview-embed.js',
    '%2e%2e/%2e%2e/onekey-tradingview-embed.js',
  ])('rejects an unsafe manifest entry: %s', async (entry) => {
    const manifest = {
      schema: 2,
      version: 'test-invalid',
      baseUrl: 'http://localhost:5180/',
      entry,
      bootstrap: {
        commonAssets: [entry],
        defaultLocale: 'en',
        localeAssets: { en: [entry] },
      },
      assets: [buildAsset(entry)],
    };
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(manifest), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      }),
    );

    await expect(
      preloadTradingViewEmbedBootstrapAssets(
        `http://localhost:5180/?entry=${encodeURIComponent(entry)}`,
      ),
    ).rejects.toThrow('TradingView embed manifest is invalid');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('loads only the pinned remote release through the service worker', async () => {
    const manifest = buildRemoteManifest('test-runtime');
    const manifestText = JSON.stringify(manifest);
    const manifestUrl = await pinRelease(
      TEST_ORIGIN,
      manifest.version,
      manifestText,
    );
    const postMessage = mockServiceWorkerController(manifest.version);
    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(manifestText, { status: 200 }));

    await preloadTradingViewEmbedBootstrapAssets(
      `${TEST_ORIGIN}/?locale=fr-FR`,
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(manifestUrl, {
      cache: 'no-store',
      credentials: 'omit',
      mode: 'cors',
      redirect: 'error',
    });
    expect(postMessage).toHaveBeenCalledWith(
      {
        type: 'PREFETCH_TRADINGVIEW_EMBED',
        payload: {
          locale: 'fr',
          manifest,
          manifestUrl,
          manifestVersion: manifest.version,
        },
      },
      expect.any(Array),
    );
  });

  test('rejects a remote manifest that does not match its pin', async () => {
    const manifest = buildRemoteManifest('test-tampered');
    await pinRelease(TEST_ORIGIN, manifest.version, JSON.stringify(manifest));
    const postMessage = mockServiceWorkerController(manifest.version);
    const tamperedManifest = {
      ...manifest,
      assets: manifest.assets.map((asset) => ({
        ...asset,
        integrity: 'sha384-YXR0YWNrZXI=',
      })),
    };
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify(tamperedManifest), { status: 200 }),
      );

    await expect(
      preloadTradingViewEmbedBootstrapAssets(`${TEST_ORIGIN}/?locale=en`),
    ).rejects.toThrow(
      'TradingView embed manifest does not match the pinned release',
    );
    expect(postMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'PREFETCH_TRADINGVIEW_EMBED' }),
      expect.any(Array),
    );
  });

  test('rejects a pinned manifest that names another version', async () => {
    const manifest = buildRemoteManifest('test-other-version');
    const manifestText = JSON.stringify(manifest);
    await pinRelease(TEST_ORIGIN, 'test-pinned-version', manifestText);
    mockServiceWorkerController('test-pinned-version');
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(manifestText, { status: 200 }));

    await expect(
      preloadTradingViewEmbedBootstrapAssets(`${TEST_ORIGIN}/?locale=en`),
    ).rejects.toThrow('TradingView embed manifest is invalid');
  });

  test('rejects before fetching a remote manifest when service worker setup is blocked', async () => {
    await pinRelease(TEST_ORIGIN, 'test-blocked', '{}');
    const originalNavigatorDescriptor = Object.getOwnPropertyDescriptor(
      globalThis,
      'navigator',
    );
    const fetchMock = jest.spyOn(globalThis, 'fetch');
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: {
        serviceWorker: {
          addEventListener: jest.fn(),
          ready: Promise.resolve(undefined),
          register: jest.fn(() => Promise.resolve(undefined)),
          removeEventListener: jest.fn(),
        },
      },
    });
    try {
      await expect(
        preloadTradingViewEmbedBootstrapAssets(
          'https://tradingview.onekeytest.com/?locale=en',
        ),
      ).rejects.toThrow(
        'TradingView embed service worker registration is unavailable',
      );
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      if (originalNavigatorDescriptor) {
        Object.defineProperty(
          globalThis,
          'navigator',
          originalNavigatorDescriptor,
        );
      } else {
        Reflect.deleteProperty(globalThis, 'navigator');
      }
    }
  });

  test('does not contact a remote chart host without a pinned release', () => {
    const postMessage = mockServiceWorkerController('unused');
    const fetchMock = jest.spyOn(globalThis, 'fetch');

    expect(() =>
      preloadTradingViewEmbedBootstrapAssets(
        'https://tradingview.onekey.so/?locale=en',
      ),
    ).toThrow('TradingView embed release is not pinned');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(postMessage).not.toHaveBeenCalled();
  });
});
