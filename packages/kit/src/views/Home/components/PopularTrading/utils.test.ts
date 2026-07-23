import type { IMarketTokenListItem } from '@onekeyhq/shared/types/marketV2';

import {
  createHomeMarketCategoryTokensCache,
  getMarketCategoryIds,
  getMarketCategoryTokensRequestKey,
  getMarketTokenDisplayPrice,
  getMarketTokenDisplayPriceChange24h,
  getMarketTokenDisplayVolume24h,
  mapMarketTokenToDisplay,
} from './utils';

describe('PopularTrading market token display utils', () => {
  test('deduplicates and sorts selected and prefetched categories', () => {
    expect(
      getMarketCategoryIds({
        prefetchMarketCategoryIds: ['stocks', 'trending', 'stocks'],
        selectedMarketCategoryId: 'perps-hot',
      }),
    ).toEqual(['perps-hot', 'stocks', 'trending']);
  });

  test('omits an absent selected category', () => {
    expect(
      getMarketCategoryIds({
        prefetchMarketCategoryIds: [],
        selectedMarketCategoryId: undefined,
      }),
    ).toEqual([]);
  });

  test('keeps liquidity scopes in independent cache keys', () => {
    expect(
      getMarketCategoryTokensRequestKey({
        minLiquidity: 1000,
        selectedMarketCategoryId: 'trending',
      }),
    ).not.toBe(
      getMarketCategoryTokensRequestKey({
        minLiquidity: 2000,
        selectedMarketCategoryId: 'trending',
      }),
    );
  });

  test('preserves cached categories when one refresh request fails', () => {
    const cache = createHomeMarketCategoryTokensCache<string>();
    const initialRequestId = cache.beginRequest({
      categoryIds: ['trending', 'stocks'],
      minLiquidity: 1000,
    });
    cache.commitCategory({
      categoryId: 'trending',
      minLiquidity: 1000,
      requestId: initialRequestId,
      tokens: ['BTC'],
    });
    cache.commitCategory({
      categoryId: 'stocks',
      minLiquidity: 1000,
      requestId: initialRequestId,
      tokens: ['AAPL'],
    });

    const refreshRequestId = cache.beginRequest({
      categoryIds: ['trending', 'stocks'],
      minLiquidity: 1000,
    });
    cache.commitCategory({
      categoryId: 'trending',
      minLiquidity: 1000,
      requestId: refreshRequestId,
      tokens: ['ETH'],
    });

    expect(
      cache.getTokens({
        minLiquidity: 1000,
        selectedMarketCategoryId: 'trending',
      }),
    ).toEqual(['ETH']);
    expect(
      cache.getTokens({
        minLiquidity: 1000,
        selectedMarketCategoryId: 'stocks',
      }),
    ).toEqual(['AAPL']);
  });

  test('makes a completed category available before its sibling settles', () => {
    const cache = createHomeMarketCategoryTokensCache<string>();
    const requestId = cache.beginRequest({
      categoryIds: ['trending', 'stocks'],
      minLiquidity: 1000,
    });

    cache.commitCategory({
      categoryId: 'trending',
      minLiquidity: 1000,
      requestId,
      tokens: ['BTC'],
    });

    expect(
      cache.getTokens({
        minLiquidity: 1000,
        selectedMarketCategoryId: 'trending',
      }),
    ).toEqual(['BTC']);
    expect(
      cache.getTokens({
        minLiquidity: 1000,
        selectedMarketCategoryId: 'stocks',
      }),
    ).toBeUndefined();
  });

  test('rejects a stale refresh that settles after the latest request', () => {
    const cache = createHomeMarketCategoryTokensCache<string>();
    const staleRequestId = cache.beginRequest({
      categoryIds: ['trending'],
      minLiquidity: 1000,
    });
    const latestRequestId = cache.beginRequest({
      categoryIds: ['trending'],
      minLiquidity: 1000,
    });

    expect(
      cache.commitCategory({
        categoryId: 'trending',
        minLiquidity: 1000,
        requestId: latestRequestId,
        tokens: ['latest'],
      }),
    ).toBe(true);
    expect(
      cache.commitCategory({
        categoryId: 'trending',
        minLiquidity: 1000,
        requestId: staleRequestId,
        tokens: ['stale'],
      }),
    ).toBe(false);

    expect(
      cache.getTokens({
        minLiquidity: 1000,
        selectedMarketCategoryId: 'trending',
      }),
    ).toEqual(['latest']);
  });

  test('keeps overlapping liquidity scope requests independent', () => {
    const cache = createHomeMarketCategoryTokensCache<string>();
    const lowLiquidityRequestId = cache.beginRequest({
      categoryIds: ['trending'],
      minLiquidity: 1000,
    });
    const highLiquidityRequestId = cache.beginRequest({
      categoryIds: ['trending'],
      minLiquidity: 2000,
    });

    cache.commitCategory({
      categoryId: 'trending',
      minLiquidity: 2000,
      requestId: highLiquidityRequestId,
      tokens: ['high-liquidity'],
    });
    cache.commitCategory({
      categoryId: 'trending',
      minLiquidity: 1000,
      requestId: lowLiquidityRequestId,
      tokens: ['low-liquidity'],
    });

    expect(
      cache.getTokens({
        minLiquidity: 1000,
        selectedMarketCategoryId: 'trending',
      }),
    ).toEqual(['low-liquidity']);
    expect(
      cache.getTokens({
        minLiquidity: 2000,
        selectedMarketCategoryId: 'trending',
      }),
    ).toEqual(['high-liquidity']);
  });

  test('normalizes placeholder market values instead of returning NaN', () => {
    const item: IMarketTokenListItem = {
      networkId: 'evm--56',
      address: '0x44f161ae29361e332dea039dfa2f404e0bc5b5cc',
      name: 'Humanity',
      symbol: 'H',
      logoUrls: ['primary.png', 'fallback.png'],
      decimals: 18,
      price: '0.00137840543892581329',
      priceChange24hPercent: '-',
      volume24h: '-',
      communityRecognized: true,
    };

    expect(getMarketTokenDisplayPrice(item)).toBe(
      parseFloat(item.price ?? '0'),
    );
    expect(getMarketTokenDisplayPriceChange24h(item)).toBe(0);
    expect(getMarketTokenDisplayVolume24h(item)).toBe(0);

    const displayToken = mapMarketTokenToDisplay(item);
    expect(displayToken?.priceChange24h).toBe(0);
    expect(Number.isNaN(displayToken?.priceChange24h)).toBe(false);
    expect(displayToken?.logoUrls).toEqual(item.logoUrls);
    expect(displayToken?.communityRecognized).toBe(true);
  });
});
