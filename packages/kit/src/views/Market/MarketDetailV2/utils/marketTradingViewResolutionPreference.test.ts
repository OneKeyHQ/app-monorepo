import appStorage from '@onekeyhq/shared/src/storage/appStorage';

import {
  clearMarketTradingViewResolutionPreferenceCache,
  getMarketTradingViewPrefetchResolution,
  hydrateMarketTradingViewPreferences,
  isMarketTradingViewPreferencesHydrated,
  startMarketTradingViewSessionPreference,
} from './marketTradingViewResolutionPreference';

jest.mock('@onekeyhq/shared/src/storage/appStorage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
  },
}));

const mockGetItem = appStorage.getItem as jest.MockedFunction<
  typeof appStorage.getItem
>;

describe('marketTradingViewResolutionPreference hydration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearMarketTradingViewResolutionPreferenceCache();
    mockGetItem.mockImplementation(async (key) => {
      if (key === 'market_trading_view_last_resolution_v1') {
        return '4H';
      }
      if (key === 'market_hyperliquid_trading_view_last_resolution_v1') {
        return '15m';
      }
      return null;
    });
  });

  it('hydrates both namespaces before a token session captures its resolution', async () => {
    expect(getMarketTradingViewPrefetchResolution('market')).toBe('1m');
    expect(isMarketTradingViewPreferencesHydrated()).toBe(false);

    await hydrateMarketTradingViewPreferences();

    expect(isMarketTradingViewPreferencesHydrated()).toBe(true);
    expect(
      startMarketTradingViewSessionPreference({
        tokenAddress: '0xabc',
        networkId: 'evm--1',
        namespace: 'market',
      }).resolution,
    ).toBe('4H');
    expect(
      startMarketTradingViewSessionPreference({
        tokenAddress: 'BTC',
        networkId: 'hyperliquid',
        namespace: 'market-hyperliquid',
      }).resolution,
    ).toBe('15m');
  });

  it('deduplicates repeated hydration calls', async () => {
    await Promise.all([
      hydrateMarketTradingViewPreferences(),
      hydrateMarketTradingViewPreferences(),
    ]);

    expect(mockGetItem).toHaveBeenCalledTimes(4);
  });
});
