import { putTradingViewResponseInCache } from './tradingViewEmbedCache';

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
    ).resolves.toBeUndefined();
    await expect(response.text()).resolves.toBe('verified asset');
  });
});
