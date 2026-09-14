import {
  TRADING_VIEW_URL,
  TRADING_VIEW_URL_TEST,
} from '@onekeyhq/shared/src/config/appConfig';

import { getTradingViewBaseUrl } from './tradingViewUrl';

const localTradingViewUrl = 'http://localhost:5173/';

describe('getTradingViewBaseUrl', () => {
  it('uses the test URL when developer mode is enabled', () => {
    expect(
      getTradingViewBaseUrl({
        devSettings: {
          enabled: true,
          settings: {},
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
          },
        },
        localTradingViewUrl,
      }),
    ).toBe(localTradingViewUrl);
  });

  it('ignores the persisted local URL switch when developer mode is disabled', () => {
    expect(
      getTradingViewBaseUrl({
        devSettings: {
          enabled: false,
          settings: {
            useLocalTradingViewUrl: true,
          },
        },
        localTradingViewUrl,
      }),
    ).toBe(TRADING_VIEW_URL);
  });
});
