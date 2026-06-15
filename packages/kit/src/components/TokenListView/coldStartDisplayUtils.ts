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

export function isRenderedTokenListCacheEntrySame(
  currentEntry: IRenderedTokenListCacheEntry | undefined,
  nextEntry: IRenderedTokenListCacheEntry,
) {
  if (
    !currentEntry ||
    currentEntry.accountId !== nextEntry.accountId ||
    currentEntry.networkId !== nextEntry.networkId ||
    currentEntry.tokenListMap !== nextEntry.tokenListMap ||
    currentEntry.aggregateTokensMap !== nextEntry.aggregateTokensMap ||
    currentEntry.tokens.length !== nextEntry.tokens.length
  ) {
    return false;
  }

  return currentEntry.tokens.every(
    (token, index) => token.$key === nextEntry.tokens[index]?.$key,
  );
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
