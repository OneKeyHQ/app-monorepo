import {
  TRADING_VIEW_URL,
  TRADING_VIEW_URL_TEST,
} from '@onekeyhq/shared/src/config/appConfig';

import { getTradingViewBaseUrl } from './tradingViewUrl';

const localTradingViewUrl = 'http://localhost:5173/';

describe('getTradingViewBaseUrl', () => {
  it('uses the production URL when developer mode is enabled by default', () => {
    expect(
      getTradingViewBaseUrl({
        devSettings: {
          enabled: true,
          settings: {},
        },
        localTradingViewUrl,
      }),
    ).toBe(TRADING_VIEW_URL);
  });

  it('uses the test URL only when its switch is enabled', () => {
    expect(
      getTradingViewBaseUrl({
        devSettings: {
          enabled: true,
          settings: {
            useTradingViewTestUrl: true,
          },
        },
        localTradingViewUrl,
      }),
    ).toBe(TRADING_VIEW_URL_TEST);
  });

  it('prioritizes the local URL over the test URL', () => {
    expect(
      getTradingViewBaseUrl({
        devSettings: {
          enabled: true,
          settings: {
            useLocalTradingViewUrl: true,
            useTradingViewTestUrl: true,
          },
        },
        localTradingViewUrl,
      }),
    ).toBe(localTradingViewUrl);
  });

  it('ignores persisted URL switches when developer mode is disabled', () => {
    expect(
      getTradingViewBaseUrl({
        devSettings: {
          enabled: false,
          settings: {
            useLocalTradingViewUrl: true,
            useTradingViewTestUrl: true,
          },
        },
        localTradingViewUrl,
      }),
    ).toBe(TRADING_VIEW_URL);
  });

  it('selects the runtime origin from a release-pinned embed manifest', () => {
    expect(
      getTradingViewBaseUrl({
        devSettings: {
          enabled: false,
          settings: {},
        },
        localTradingViewUrl,
        pinnedEmbedManifestUrl:
          'https://tradingview.onekeytest.com/test-release/embed/embed-manifest.json',
      }),
    ).toBe(TRADING_VIEW_URL_TEST);
  });

  it.each([
    'https://tradingview.onekeytest.com/embed/latest.json',
    'https://evil.example/test-release/embed/embed-manifest.json',
    'https://tradingview.onekeytest.com/test-release/embed/embed-manifest.json?next=1',
  ])('ignores an unpinned or untrusted embed manifest URL: %s', (url) => {
    expect(
      getTradingViewBaseUrl({
        devSettings: {
          enabled: false,
          settings: {},
        },
        localTradingViewUrl,
        pinnedEmbedManifestUrl: url,
      }),
    ).toBe(TRADING_VIEW_URL);
  });
});
