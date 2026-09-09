/** @jest-environment jsdom */

import { renderHook } from '@testing-library/react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type { IMarketAssetListItem } from '@onekeyhq/shared/types/market';

import { useHomeMarketCategoryTokens } from './useHomeMarketCategoryTokens';

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceHyperliquid: {
      getTokenSearchAliases: jest.fn(),
    },
    serviceMarket: {
      fetchMarketAssetList: jest.fn(),
    },
    serviceMarketV2: {
      fetchMarketPerpsTokenList: jest.fn(),
      fetchMarketTokenList: jest.fn(),
    },
  },
}));

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: jest.fn(),
}));

const mockUsePromiseResult = usePromiseResult as jest.Mock;
const serviceMarket = backgroundApiProxy.serviceMarket as jest.Mocked<
  typeof backgroundApiProxy.serviceMarket
>;
const serviceMarketV2 = backgroundApiProxy.serviceMarketV2 as jest.Mocked<
  typeof backgroundApiProxy.serviceMarketV2
>;

const bitcoin: IMarketAssetListItem = {
  assetId: 'bitcoin',
  symbol: 'btc',
  logoUrl: 'https://example.com/btc.png',
  price: '100000',
  priceChange24hPercent: '1',
  priceChange7dPercent: '2',
  marketCap: '2000000000000',
  volume24h: '50000000000',
  sparkline24h: [],
};

describe('useHomeMarketCategoryTokens', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUsePromiseResult.mockReturnValue({
      isLoading: false,
      result: undefined,
    });
  });

  it('loads Top Coins from the Asset API instead of the token list API', async () => {
    serviceMarket.fetchMarketAssetList.mockResolvedValue({
      list: [bitcoin],
      total: 1,
    });

    renderHook(() =>
      useHomeMarketCategoryTokens({
        minLiquidity: 5000,
        selectedMarketCategoryId: 'top_coins',
      }),
    );

    const loadCategoryTokens = mockUsePromiseResult.mock
      .calls[0][0] as () => Promise<{
      requestKey: string;
      tokens: unknown[];
    }>;
    const result = await loadCategoryTokens();

    expect(serviceMarket.fetchMarketAssetList.mock.calls).toEqual([
      [
        {
          currency: 'usd',
          limit: 3,
          page: 1,
          type: 'top_coins',
        },
      ],
    ]);
    expect(serviceMarketV2.fetchMarketTokenList.mock.calls).toHaveLength(0);
    expect(result).toMatchObject({
      requestKey: 'top_coins:5000',
      tokens: [
        {
          symbol: 'BTC',
          marketAsset: bitcoin,
        },
      ],
    });
  });
});
