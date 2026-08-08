import { jest } from '@jest/globals';

import { preloadTradingViewEmbedBootstrapAssets } from './tradingViewEmbedLoader.web';

const buildAsset = (file: string) => ({
  file,
  integrity: 'sha384-test',
  size: 1,
});

describe('preloadTradingViewEmbedBootstrapAssets', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('preloads the localized TradingView bootstrap assets', async () => {
    const manifest = {
      schema: 1,
      version: 'test-v1',
      baseUrl: 'http://localhost:5173/',
      entry: 'onekey-tradingview-embed.js',
      styles: [],
      bootstrapAssets: [
        'charting_library/bundles/runtime.hash.js',
        'charting_library/bundles/__LANG__.hash.js',
        'charting_library/bundles/library.hash.js',
      ],
      assets: [
        buildAsset('onekey-tradingview-embed.js'),
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
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchCalls.slice(1).map(([input]) => input.toString())).toEqual(
      expect.arrayContaining([
        'http://localhost:5173/charting_library/bundles/runtime.hash.js',
        'http://localhost:5173/charting_library/bundles/zh.hash.js',
        'http://localhost:5173/charting_library/bundles/library.hash.js',
      ]),
    );
    expect(fetchCalls.slice(1).map(([, init]) => init)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          cache: 'force-cache',
          credentials: 'omit',
          integrity: 'sha384-test',
          mode: 'cors',
        }),
      ]),
    );
  });

  test('falls back to the English locale asset', async () => {
    const manifest = {
      schema: 1,
      version: 'test-v2',
      baseUrl: 'http://127.0.0.1:5173/',
      entry: 'onekey-tradingview-embed.js',
      styles: [],
      bootstrapAssets: ['charting_library/bundles/__LANG__.hash.js'],
      assets: [
        buildAsset('onekey-tradingview-embed.js'),
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
});
