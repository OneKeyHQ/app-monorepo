/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import { Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IMarketToken } from '@onekeyhq/shared/types/market';

import { useMarketTopCoins } from './useMarketTopCoins';

const mockToMarketDetailPage = jest.fn();

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => ({
  Toast: { error: jest.fn() },
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceMarket: {
      fetchCategory: jest.fn(),
      fetchMarketTokenDetail: jest.fn(),
    },
  },
}));

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: jest.fn(() => ({ result: [], isLoading: false })),
}));

jest.mock('@onekeyhq/kit/src/views/Market/utils/legacyMarketNetwork', () => ({
  getLegacyMarketNavigationTarget: jest.fn(),
}));

jest.mock('../../MarketTokenList/hooks/useToMarketDetailPage', () => ({
  useToDetailPage: () => mockToMarketDetailPage,
}));

const bitcoin: IMarketToken = {
  coingeckoId: 'bitcoin',
  name: 'Bitcoin',
  serialNumber: 1,
  price: 100_000,
  totalVolume: 1_000_000,
  marketCap: 2_000_000,
  symbol: 'btc',
  iconUrl: 'https://example.com/btc.png',
  isSupportBuy: true,
  image: '',
  priceChangePercentage1H: 0,
  priceChangePercentage24H: 1,
  priceChangePercentage7D: 2,
  sparkline: [],
  lastUpdated: '2026-08-31T00:00:00Z',
};

describe('useMarketTopCoins', () => {
  const serviceMarket = backgroundApiProxy.serviceMarket as jest.Mocked<
    typeof backgroundApiProxy.serviceMarket
  >;

  beforeEach(() => {
    jest.clearAllMocks();
    serviceMarket.fetchMarketTokenDetail.mockRejectedValue(
      new Error('utility unavailable'),
    );
    mockToMarketDetailPage.mockResolvedValue(undefined);
  });

  it('falls back to the CoinGecko detail route when lookup fails', async () => {
    const { result } = renderHook(() => useMarketTopCoins());

    await act(async () => {
      await result.current.handleItemPress(bitcoin);
      await result.current.handleItemPress(bitcoin);
    });

    expect(serviceMarket.fetchMarketTokenDetail.mock.calls).toHaveLength(2);
    expect(mockToMarketDetailPage).toHaveBeenCalledTimes(2);
    expect(mockToMarketDetailPage).toHaveBeenLastCalledWith({
      address: 'bitcoin',
      change24h: 1,
      decimals: 0,
      disableTrade: true,
      marketCap: 2_000_000,
      marketTokenId: 'bitcoin',
      name: 'Bitcoin',
      networkId: 'coingecko',
      price: 100_000,
      showFavoriteButton: false,
      skipMarketDataFetch: true,
      symbol: 'BTC',
      tokenAddress: 'bitcoin',
      tokenImageUri: 'https://example.com/btc.png',
      turnover: 1_000_000,
    });
    expect(Toast.error).not.toHaveBeenCalled();
  });

  it('reports a navigation failure and releases the navigation guard', async () => {
    mockToMarketDetailPage
      .mockRejectedValueOnce(new Error('navigation unavailable'))
      .mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useMarketTopCoins());

    await act(async () => {
      await result.current.handleItemPress(bitcoin);
      await result.current.handleItemPress(bitcoin);
    });

    expect(Toast.error).toHaveBeenCalledWith({
      title: ETranslations.global_an_error_occurred,
    });
    expect(mockToMarketDetailPage).toHaveBeenCalledTimes(2);
  });
});
