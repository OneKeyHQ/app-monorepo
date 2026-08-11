import {
  buildTradingViewEmbedProxyBaseUrl,
  resolveTradingViewEmbedProxySourceUrl,
} from './tradingViewEmbedAssetProxy';

describe('tradingViewEmbedAssetProxy', () => {
  test.each([
    'https://tradingview.onekey.so',
    'https://tradingview.onekeytest.com',
  ])('maps trusted release assets through the app origin: %s', (origin) => {
    const proxyBaseUrl = buildTradingViewEmbedProxyBaseUrl({
      appOrigin: 'https://app-bundle.onekeytest.com/market',
      sourceBaseUrl: `${origin}/release-v1/embed/`,
    });

    expect(proxyBaseUrl).toBe(
      `https://app-bundle.onekeytest.com/__onekey_tradingview_embed__/${new URL(origin).hostname}/release-v1/embed/`,
    );
    expect(
      resolveTradingViewEmbedProxySourceUrl(
        `${proxyBaseUrl}charting_library/bundles/runtime.hash.js`,
      ),
    ).toBe(
      `${origin}/release-v1/embed/charting_library/bundles/runtime.hash.js`,
    );
  });

  test('rejects untrusted source origins', () => {
    expect(
      buildTradingViewEmbedProxyBaseUrl({
        appOrigin: 'https://app.onekey.so',
        sourceBaseUrl: 'https://evil.example/release-v1/embed/',
      }),
    ).toBeUndefined();
    expect(
      resolveTradingViewEmbedProxySourceUrl(
        'https://app.onekey.so/__onekey_tradingview_embed__/evil.example/release-v1/embed/entry.js',
      ),
    ).toBeUndefined();
  });

  test.each([
    'https://app.onekey.so/__onekey_tradingview_embed__/tradingview.onekey.so/release-v1/embed/',
    'https://app.onekey.so/__onekey_tradingview_embed__/tradingview.onekey.so/release-v1/embed/entry.js?cache=1',
    'https://app.onekey.so/__onekey_tradingview_embed__/tradingview.onekey.so/invalid/version/entry.js',
  ])('rejects malformed proxy asset URLs: %s', (requestUrl) => {
    expect(resolveTradingViewEmbedProxySourceUrl(requestUrl)).toBeUndefined();
  });
});
