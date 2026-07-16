import type { IMarketWatchListItemV2 } from '@onekeyhq/shared/types/market';

import {
  buildNativeHomeFavoriteTokensResult,
  setNativeHomeWatchListTokenFavorite,
} from './nativeHomeMarketFavorites';

import type { IFavoriteTokenDisplay } from './components/PopularTrading/types';

function buildToken(symbol: string, index: number): IFavoriteTokenDisplay {
  return {
    chainId: 'evm--1',
    contractAddress: `0x${index}`,
    isNative: false,
    logoUrl: '',
    marketCap: 0,
    name: symbol,
    price: 0,
    priceChange24h: 0,
    symbol,
    volume24h: 0,
  };
}

function buildWatchListItem(
  index: number,
  sortIndex = index,
): IMarketWatchListItemV2 {
  return {
    chainId: 'evm--1',
    contractAddress: `0x${index}`,
    isNative: false,
    sortIndex,
  };
}

describe('Native Home favorite optimistic transitions', () => {
  const tokens = [1, 2, 3, 4, 5].map((index) =>
    buildToken(`TOKEN${index}`, index),
  );

  it('uses the cached fourth token to keep three visible rows for 5 -> 4', () => {
    const result = buildNativeHomeFavoriteTokensResult({
      cachedTokens: tokens.slice(0, 4),
      watchListItems: [2, 3, 4, 5].map((index) => buildWatchListItem(index)),
    });

    expect(result).toMatchObject({
      isRecommendation: false,
      total: 4,
    });
    expect(result?.tokens.map((token) => token.symbol)).toEqual([
      'TOKEN2',
      'TOKEN3',
      'TOKEN4',
    ]);
  });

  it('commits the remaining two rows directly for 3 -> 2', () => {
    const result = buildNativeHomeFavoriteTokensResult({
      cachedTokens: tokens.slice(0, 3),
      watchListItems: [2, 3].map((index) => buildWatchListItem(index)),
    });

    expect(result?.total).toBe(2);
    expect(result?.tokens.map((token) => token.symbol)).toEqual([
      'TOKEN2',
      'TOKEN3',
    ]);
  });

  it('switches the last favorite directly to the prefetched recommendations', () => {
    const recommendationTokens = [6, 7, 8, 9].map((index) =>
      buildToken(`RECOMMEND${index}`, index),
    );
    const result = buildNativeHomeFavoriteTokensResult({
      cachedTokens: [tokens[0]],
      recommendationResult: {
        isRecommendation: true,
        requestKey: 'recommendations',
        tokens: recommendationTokens,
        total: 0,
      },
      watchListItems: [],
    });

    expect(result?.isRecommendation).toBe(true);
    expect(result?.requestKey).toBe('favorites:');
    expect(result?.tokens).toEqual(recommendationTokens);
  });

  it('restores a failed removal at its original index', () => {
    const restored = setNativeHomeWatchListTokenFavorite({
      favorite: true,
      items: [buildWatchListItem(1), buildWatchListItem(3)],
      previousIndex: 1,
      previousItem: buildWatchListItem(2),
      token: tokens[1],
    });

    expect(restored.map((item) => item.contractAddress)).toEqual([
      '0x1',
      '0x2',
      '0x3',
    ]);
  });

  it('prepends a newly favorited category token', () => {
    const added = setNativeHomeWatchListTokenFavorite({
      favorite: true,
      items: [buildWatchListItem(1), buildWatchListItem(2)],
      token: tokens[4],
    });

    expect(added.map((item) => item.contractAddress)).toEqual([
      '0x5',
      '0x1',
      '0x2',
    ]);
  });
});
