import { jest } from '@jest/globals';

import {
  loadTradingViewEmbedModule,
  preloadTradingViewEmbedBootstrapAssets,
} from './tradingViewEmbedLoader.web';

const buildAsset = (file: string) => ({
  file,
  integrity: 'sha384-dGVzdA==',
  size: 1,
});

describe('preloadTradingViewEmbedBootstrapAssets', () => {
  afterEach(() => {
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
      { cache: 'no-store', credentials: 'omit' },
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

  test('requires a release-pinned manifest for remote code', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch');

    await expect(
      loadTradingViewEmbedModule('https://tradingview.onekey.so/'),
    ).rejects.toThrow('requires a release-pinned manifest');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('prefetches the release-pinned manifest through the service worker', async () => {
    const manifest = {
      schema: 2,
      version: 'test-pinned',
      baseUrl: 'https://tradingview.onekey.so/test-pinned/embed/',
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
    };
    const buildManifestUrl =
      'https://app-assets.onekey.so/tradingview-embed-manifest.test-pinned.json';
    process.env.TRADINGVIEW_EMBED_BUILD_MANIFEST_URL = buildManifestUrl;
    process.env.TRADINGVIEW_EMBED_BUILD_MANIFEST_INTEGRITY =
      'sha384-build-manifest';
    const originalNavigatorDescriptor = Object.getOwnPropertyDescriptor(
      globalThis,
      'navigator',
    );
    const postMessage = jest.fn(
      (_message: unknown, transfer: Transferable[] | undefined) => {
        const replyPort = transfer?.[0] as MessagePort | undefined;
        replyPort?.postMessage({ ok: true, version: manifest.version });
      },
    );
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { serviceWorker: { controller: { postMessage } } },
    });
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(manifest), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      }),
    );

    try {
      await preloadTradingViewEmbedBootstrapAssets(
        'https://tradingview.onekey.so/?locale=zh-CN',
      );

      expect(fetchMock).toHaveBeenCalledWith(new URL(buildManifestUrl), {
        cache: 'force-cache',
        credentials: 'omit',
        integrity: 'sha384-build-manifest',
        mode: 'cors',
      });
      expect(postMessage).toHaveBeenCalledWith(
        {
          type: 'PREFETCH_TRADINGVIEW_EMBED',
          payload: {
            locale: 'zh',
            manifestUrl: 'https://tradingview.onekey.so/embed/latest.json',
            manifestVersion: manifest.version,
          },
        },
        expect.any(Array),
      );
    } finally {
      delete process.env.TRADINGVIEW_EMBED_BUILD_MANIFEST_URL;
      delete process.env.TRADINGVIEW_EMBED_BUILD_MANIFEST_INTEGRITY;
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
});
