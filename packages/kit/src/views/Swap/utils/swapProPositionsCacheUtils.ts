import BigNumber from 'bignumber.js';

import {
  SWAP_PRO_POSITIONS_CACHE_MAX_BYTES,
  SWAP_PRO_POSITIONS_CACHE_MAX_OWNERS,
  SWAP_PRO_POSITIONS_CACHE_MAX_TOKENS_PER_OWNER,
  SWAP_PRO_POSITIONS_CACHE_MAX_TOTAL_TOKENS,
  SWAP_PRO_POSITIONS_CACHE_VERSION,
  pruneSwapProPositionsCacheValue,
} from '@onekeyhq/shared/src/utils/coldStartCacheSnapshotUtils';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

export const SWAP_PRO_POSITIONS_CACHE_TTL_MS = 30_000;
export {
  SWAP_PRO_POSITIONS_CACHE_MAX_BYTES,
  SWAP_PRO_POSITIONS_CACHE_MAX_OWNERS,
  SWAP_PRO_POSITIONS_CACHE_MAX_TOKENS_PER_OWNER,
  SWAP_PRO_POSITIONS_CACHE_MAX_TOTAL_TOKENS,
  SWAP_PRO_POSITIONS_CACHE_VERSION,
};

export type ISwapProPositionsCacheEntry = {
  ownerKey: string;
  networkIdsKey: string;
  currencyId: string;
  tokens: ISwapToken[];
  updatedAt: number;
};

export type ISwapProPositionsCache = {
  version: typeof SWAP_PRO_POSITIONS_CACHE_VERSION;
  byOwner: Record<string, ISwapProPositionsCacheEntry>;
};

export const EMPTY_SWAP_PRO_POSITIONS_CACHE: ISwapProPositionsCache = {
  version: SWAP_PRO_POSITIONS_CACHE_VERSION,
  byOwner: {},
};

export function getValidSwapProPositionsCache(
  cache: unknown,
): ISwapProPositionsCache {
  if (
    typeof cache !== 'object' ||
    cache === null ||
    Array.isArray(cache) ||
    (cache as Partial<ISwapProPositionsCache>).version !==
      SWAP_PRO_POSITIONS_CACHE_VERSION ||
    typeof (cache as Partial<ISwapProPositionsCache>).byOwner !== 'object' ||
    (cache as Partial<ISwapProPositionsCache>).byOwner === null ||
    Array.isArray((cache as Partial<ISwapProPositionsCache>).byOwner)
  ) {
    return EMPTY_SWAP_PRO_POSITIONS_CACHE;
  }
  return cache as ISwapProPositionsCache;
}

function buildSwapProPositionsCacheToken(token: ISwapToken): ISwapToken {
  return {
    networkId: token.networkId,
    contractAddress: token.contractAddress,
    symbol: token.symbol,
    decimals: token.decimals,
    isNative: token.isNative,
    name: token.name,
    logoURI: token.logoURI,
    networkLogoURI: token.networkLogoURI,
    balanceParsed: token.balanceParsed,
    fiatValue: token.fiatValue,
    price: token.price,
  };
}

function getSwapProPositionFiatValue(token: ISwapToken) {
  const fiatValue = new BigNumber(token.fiatValue ?? '0');
  return fiatValue.isFinite() ? fiatValue : new BigNumber(0);
}

export function upsertSwapProPositionsCacheEntry({
  cache,
  entry,
}: {
  cache: unknown;
  entry: ISwapProPositionsCacheEntry;
}): ISwapProPositionsCache {
  const tokens = entry.tokens
    .toSorted((left, right) =>
      getSwapProPositionFiatValue(right).comparedTo(
        getSwapProPositionFiatValue(left),
      ),
    )
    .map(buildSwapProPositionsCacheToken);
  const previousByOwner = getValidSwapProPositionsCache(cache).byOwner;

  return pruneSwapProPositionsCacheValue<ISwapProPositionsCache>({
    value: {
      version: SWAP_PRO_POSITIONS_CACHE_VERSION,
      byOwner: {
        ...previousByOwner,
        [entry.ownerKey]: {
          ...entry,
          tokens,
        },
      },
    },
  });
}

export function shouldReuseSwapProPositionsCache({
  cacheEntry,
  forceRefresh,
  now = Date.now(),
  ownerKey,
}: {
  cacheEntry?: {
    ownerKey: string;
    updatedAt: number;
  };
  forceRefresh?: boolean;
  now?: number;
  ownerKey: string;
}) {
  return Boolean(
    !forceRefresh &&
    ownerKey &&
    cacheEntry?.ownerKey === ownerKey &&
    now - cacheEntry.updatedAt < SWAP_PRO_POSITIONS_CACHE_TTL_MS,
  );
}
