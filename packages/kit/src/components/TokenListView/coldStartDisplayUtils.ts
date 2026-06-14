import { flattenAggregateTokensMap } from '@onekeyhq/shared/src/utils/tokenUtils';
import type { IAccountToken, ITokenFiat } from '@onekeyhq/shared/types/token';

export type IRenderedTokenListCacheEntry = {
  tokens: IAccountToken[];
  tokenListMap?: Record<string, ITokenFiat>;
  aggregateTokensMap?: Record<string, Record<string, ITokenFiat>>;
  accountId: string;
  networkId: string;
};

export function isRenderedTokenListCacheEntryReady(
  cachedEntry: IRenderedTokenListCacheEntry | undefined,
): cachedEntry is IRenderedTokenListCacheEntry & {
  tokenListMap: Record<string, ITokenFiat>;
} {
  return Boolean(cachedEntry?.tokens.length && cachedEntry.tokenListMap);
}

export function getColdStartTokenListDisplayMaps({
  shouldUseCachedMaps,
  cachedEntry,
  currentTokenListMap,
  currentAggregateTokenMap,
}: {
  shouldUseCachedMaps: boolean;
  cachedEntry: IRenderedTokenListCacheEntry | undefined;
  currentTokenListMap: Record<string, ITokenFiat>;
  currentAggregateTokenMap: Record<string, ITokenFiat>;
}) {
  if (shouldUseCachedMaps && isRenderedTokenListCacheEntryReady(cachedEntry)) {
    const aggregateTokenMap = flattenAggregateTokensMap(
      cachedEntry.aggregateTokensMap ?? {},
    );
    return {
      aggregateTokenMap,
      contextTokenListMap: {
        ...cachedEntry.tokenListMap,
        ...aggregateTokenMap,
      },
      isUsingCachedMaps: true,
      tokenListMap: cachedEntry.tokenListMap,
    };
  }

  return {
    aggregateTokenMap: currentAggregateTokenMap,
    contextTokenListMap: currentTokenListMap,
    isUsingCachedMaps: false,
    tokenListMap: currentTokenListMap,
  };
}
