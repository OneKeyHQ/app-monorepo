import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import type { IMarketWatchListItemV2 } from '@onekeyhq/shared/types/market';

import type { IFavoriteTokenDisplay } from './components/PopularTrading/types';

export const HOME_MARKET_VISIBLE_FAVORITES_COUNT = 3;
export const HOME_MARKET_FAVORITES_CACHE_COUNT = 4;

export type IFavoriteTokensResult = {
  isRecommendation: boolean;
  requestKey: string;
  total: number;
  tokens: IFavoriteTokenDisplay[];
};

export function getNativeHomeWatchListContentKey(
  items: IMarketWatchListItemV2[],
): string {
  return items
    .map(
      (item) =>
        `${item.perpsCoin ?? ''}:${item.chainId}:${item.contractAddress}:${
          item.sortIndex ?? ''
        }`,
    )
    .join('|');
}

export function isNativeHomeWatchListItemForToken(
  item: IMarketWatchListItemV2,
  token: IFavoriteTokenDisplay,
): boolean {
  if (token.perpsCoin) {
    return item.perpsCoin === token.perpsCoin;
  }
  return equalTokenNoCaseSensitive({
    token1: {
      networkId: token.chainId,
      contractAddress: token.contractAddress,
    },
    token2: {
      networkId: item.chainId,
      contractAddress: item.contractAddress,
    },
  });
}

export function setNativeHomeWatchListTokenFavorite({
  favorite,
  items,
  previousIndex,
  previousItem,
  token,
}: {
  favorite: boolean;
  items: IMarketWatchListItemV2[];
  previousIndex?: number;
  previousItem?: IMarketWatchListItemV2;
  token: IFavoriteTokenDisplay;
}): IMarketWatchListItemV2[] {
  const filteredItems = items.filter(
    (item) => !isNativeHomeWatchListItemForToken(item, token),
  );
  if (!favorite) return filteredItems;

  const firstSortIndex = filteredItems[0]?.sortIndex ?? 1000;
  const nextItem: IMarketWatchListItemV2 = token.perpsCoin
    ? {
        chainId: '',
        contractAddress: '',
        perpsCoin: token.perpsCoin,
        sortIndex: previousItem?.sortIndex ?? firstSortIndex - 1,
      }
    : {
        chainId: token.chainId,
        contractAddress: token.contractAddress,
        isNative: token.isNative,
        sortIndex: previousItem?.sortIndex ?? firstSortIndex - 1,
      };
  const insertIndex =
    previousItem && previousIndex !== undefined
      ? Math.max(0, Math.min(previousIndex, filteredItems.length))
      : 0;
  return [
    ...filteredItems.slice(0, insertIndex),
    nextItem,
    ...filteredItems.slice(insertIndex),
  ];
}

export function buildNativeHomeFavoriteTokensResult({
  cachedTokens,
  recommendationResult,
  watchListItems,
}: {
  cachedTokens: IFavoriteTokenDisplay[];
  recommendationResult?: IFavoriteTokensResult;
  watchListItems: IMarketWatchListItemV2[];
}): IFavoriteTokensResult | undefined {
  const requestKey = `favorites:${getNativeHomeWatchListContentKey(
    watchListItems,
  )}`;
  if (watchListItems.length === 0) {
    return recommendationResult
      ? {
          ...recommendationResult,
          isRecommendation: true,
          requestKey,
          total: 0,
        }
      : undefined;
  }

  return {
    isRecommendation: false,
    requestKey,
    total: watchListItems.length,
    tokens: watchListItems
      .slice(0, HOME_MARKET_FAVORITES_CACHE_COUNT)
      .map((item) =>
        cachedTokens.find((token) =>
          isNativeHomeWatchListItemForToken(item, token),
        ),
      )
      .filter((token): token is IFavoriteTokenDisplay => Boolean(token)),
  };
}
