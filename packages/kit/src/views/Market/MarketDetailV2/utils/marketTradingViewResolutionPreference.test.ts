import appStorage from '@onekeyhq/shared/src/storage/appStorage';

import {
  clearMarketTradingViewResolutionPreferenceCache,
  getMarketTradingViewPrefetchResolution,
  getMarketTradingViewSessionPreference,
  hydrateMarketTradingViewPreferences,
  isMarketTradingViewPreferencesHydrated,
  startMarketTradingViewSessionPreference,
  updateMarketTradingViewSessionResolution,
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

function buildTokenAddress(index: number) {
  return `0x${index.toString(16).padStart(40, '0')}`;
}

describe('marketTradingViewResolutionPreference', () => {
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

  it('hydrates both namespaces before capturing a token session', async () => {
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

  it('evicts the least recently used session preference at the size limit', () => {
    const firstTokenAddress = buildTokenAddress(1);
    const secondTokenAddress = buildTokenAddress(2);

    for (let index = 1; index <= 100; index += 1) {
      const tokenAddress = buildTokenAddress(index);
      startMarketTradingViewSessionPreference({
        tokenAddress,
        networkId: 'evm--1',
      });
      if (index === 1 || index === 2) {
        updateMarketTradingViewSessionResolution({
          tokenAddress,
          networkId: 'evm--1',
          resolution: index === 1 ? '5m' : '15m',
        });
      }
    }

    expect(
      getMarketTradingViewSessionPreference({
        tokenAddress: firstTokenAddress,
        networkId: 'evm--1',
      }).resolution,
    ).toBe('5m');

    startMarketTradingViewSessionPreference({
      tokenAddress: buildTokenAddress(101),
      networkId: 'evm--1',
    });

    expect(
      getMarketTradingViewSessionPreference({
        tokenAddress: firstTokenAddress,
        networkId: 'evm--1',
      }).resolution,
    ).toBe('5m');
    expect(
      getMarketTradingViewSessionPreference({
        tokenAddress: secondTokenAddress,
        networkId: 'evm--1',
      }).resolution,
    ).toBe('1m');
  });
});
