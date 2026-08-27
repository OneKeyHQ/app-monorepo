import {
  cacheTradingViewCompletionMarker,
  putTradingViewResponseInCache,
} from './tradingViewEmbedCache';

describe('putTradingViewResponseInCache', () => {
  test('does not reject when Cache Storage is unavailable', async () => {
    const response = new Response('verified asset');
    const cache = {
      put: jest.fn(() => Promise.reject(new Error('QuotaExceededError'))),
    };

    await expect(
      putTradingViewResponseInCache(
        cache,
        new Request('https://tradingview.onekey.so/v1/embed/entry.js'),
        response,
      ),
    ).resolves.toBe(false);
    await expect(response.text()).resolves.toBe('verified asset');
  });

  test('reports successful Cache Storage writes', async () => {
    const cache = { put: jest.fn(() => Promise.resolve()) };

    await expect(
      putTradingViewResponseInCache(
        cache,
        new Request('https://tradingview.onekey.so/v1/embed/entry.js'),
        new Response('verified asset'),
      ),
    ).resolves.toBe(true);
  });
});

describe('cacheTradingViewCompletionMarker', () => {
  const manifestRequest = new Request(
    'https://tradingview.onekey.so/v1/embed/embed-manifest.json',
  );

  test('does not mark an incomplete release as offline-ready', async () => {
    const cache = { put: jest.fn(() => Promise.resolve()) };

    await expect(
      cacheTradingViewCompletionMarker(
        cache,
        manifestRequest,
        new Response('{}'),
        false,
      ),
    ).resolves.toBe(false);
    expect(cache.put).not.toHaveBeenCalled();
  });

  test('stores the marker after every release asset is cached', async () => {
    const cache = { put: jest.fn(() => Promise.resolve()) };

    await expect(
      cacheTradingViewCompletionMarker(
        cache,
        manifestRequest,
        new Response('{}'),
        true,
      ),
    ).resolves.toBe(true);
    expect(cache.put).toHaveBeenCalledTimes(1);
  });
});
