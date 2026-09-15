/** @jest-environment jsdom */

import { renderHook } from '@testing-library/react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type { IMarketAssetListItem } from '@onekeyhq/shared/types/market';
import type { IMarketStockPublicItem } from '@onekeyhq/shared/types/marketV2';

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
      fetchMarketStockList: jest.fn(),
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

  it('loads the Stocks tab from the public stocks API instead of the token list API', async () => {
    const apple: IMarketStockPublicItem = {
      stockId: 'AAPL',
      symbol: 'AAPL',
      name: 'Apple',
      logoUrl: 'https://example.com/aapl.png',
      assetType: 'stock',
      price: '77.25',
      priceChange24hPercent: '0.32',
      marketCap: '4560000000000',
      volume24h: '10670000000',
      currency: 'USD',
    };
    serviceMarketV2.fetchMarketStockList.mockResolvedValue({
      items: [apple],
      total: 1,
    });

    renderHook(() =>
      useHomeMarketCategoryTokens({
        minLiquidity: 5000,
        selectedMarketCategoryId: 'stocks',
      }),
    );

    const loadCategoryTokens = mockUsePromiseResult.mock
      .calls[0][0] as () => Promise<{
      requestKey: string;
      tokens: unknown[];
    }>;
    const result = await loadCategoryTokens();

    expect(serviceMarketV2.fetchMarketStockList.mock.calls).toEqual([
      [{ limit: 3 }],
    ]);
    expect(serviceMarketV2.fetchMarketTokenList.mock.calls).toHaveLength(0);
    expect(result).toMatchObject({
      requestKey: 'stocks:5000',
      tokens: [
        {
          stockId: 'AAPL',
          symbol: 'AAPL',
          stockListingName: 'Apple',
        },
      ],
    });
  });

  it('keeps non-stock tabs on the token list API', async () => {
    serviceMarketV2.fetchMarketTokenList.mockResolvedValue({
      list: [],
      total: 0,
    });

    renderHook(() =>
      useHomeMarketCategoryTokens({
        minLiquidity: 5000,
        selectedMarketCategoryId: 'robinhood_meme',
      }),
    );

    const loadCategoryTokens = mockUsePromiseResult.mock
      .calls[0][0] as () => Promise<{
      requestKey: string;
      tokens: unknown[];
    }>;
    await loadCategoryTokens();

    expect(serviceMarketV2.fetchMarketStockList.mock.calls).toHaveLength(0);
    expect(serviceMarketV2.fetchMarketTokenList.mock.calls).toEqual([
      [
        expect.objectContaining({
          type: 'robinhood_meme',
          limit: 3,
        }),
      ],
    ]);
  });
});
