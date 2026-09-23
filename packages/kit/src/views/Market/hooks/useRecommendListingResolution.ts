import { useMemo, useRef } from 'react';

import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';

import {
  type IRecommendWatchlistInput,
  type IRecommendWatchlistItem,
  mapRecommendTokensToWatchlistItems,
} from '../utils/mapRecommendTokensToWatchlistItems';

const EMPTY_RECOMMEND_LISTINGS: IRecommendWatchlistItem[] = [];

export const EMPTY_RECOMMEND_LISTING_TOKENS: IRecommendWatchlistInput[] = [];

type IRecommendListingResolution = {
  resolutionKey: string;
  items: IRecommendWatchlistItem[];
};

export function useRecommendListingResolution(
  tokens: IRecommendWatchlistInput[],
): IRecommendWatchlistItem[] | undefined {
  const tokensRef = useRef(tokens);
  tokensRef.current = tokens;
  const resolutionKey = useMemo(
    () =>
      tokens
        .map(
          (token) =>
            `${token.chainId}:${token.contractAddress}:${token.symbol ?? ''}:${token.assetId ?? ''}:${token.stockId ?? ''}`,
        )
        .join('\n'),
    [tokens],
  );

  const { result } = usePromiseResult(
    async () => {
      if (!resolutionKey) {
        return {
          resolutionKey,
          items: EMPTY_RECOMMEND_LISTINGS,
        } satisfies IRecommendListingResolution;
      }
      return {
        resolutionKey,
        items: await mapRecommendTokensToWatchlistItems(tokensRef.current),
      } satisfies IRecommendListingResolution;
    },
    [resolutionKey],
    { undefinedResultIfReRun: true },
  );

  // A token-list change re-renders once before the effect clears the previous
  // result. Ignore that result so its asset ids cannot be applied by index.
  if (result?.resolutionKey !== resolutionKey) {
    return undefined;
  }
  return result.items;
}
