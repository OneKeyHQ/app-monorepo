import { useEffect } from 'react';

import {
  type IPerpsActiveAssetCtxColdCacheAtom,
  usePerpsActiveAssetCtxColdCacheAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/atoms';
import {
  type IPerpsActiveAssetCtxAtom,
  usePerpsActiveAssetAtom,
  usePerpsActiveAssetCtxDisplayAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  PERPS_ACTIVE_ASSET_CTX_COLD_CACHE_MAX_AGE_MS,
  PERPS_ACTIVE_ASSET_CTX_COLD_CACHE_MAX_ENTRIES,
  PERPS_ACTIVE_ASSET_CTX_COLD_CACHE_MIN_WRITE_INTERVAL_MS,
} from '@onekeyhq/shared/src/consts/perpCache';

function hasDisplayMarketPrice(assetCtx: IPerpsActiveAssetCtxAtom) {
  if (!assetCtx?.ctx) {
    return false;
  }
  return [assetCtx.ctx.markPrice, assetCtx.ctx.midPrice].some((price) => {
    const priceNumber = Number.parseFloat(price ?? '');
    return Number.isFinite(priceNumber) && priceNumber > 0;
  });
}

function isDisplayAssetCtx({
  assetCtx,
  coin,
}: {
  assetCtx: IPerpsActiveAssetCtxAtom;
  coin: string | undefined;
}) {
  return Boolean(
    coin && assetCtx?.coin === coin && hasDisplayMarketPrice(assetCtx),
  );
}

function limitColdCacheEntries(
  cache: IPerpsActiveAssetCtxColdCacheAtom,
): IPerpsActiveAssetCtxColdCacheAtom {
  return Object.fromEntries(
    Object.entries(cache)
      .toSorted((a, b) => b[1].updatedAt - a[1].updatedAt)
      .slice(0, PERPS_ACTIVE_ASSET_CTX_COLD_CACHE_MAX_ENTRIES),
  );
}

export function upsertPerpsActiveAssetCtxColdCacheEntry({
  cache,
  data,
  updatedAt,
}: {
  cache: IPerpsActiveAssetCtxColdCacheAtom;
  data: NonNullable<IPerpsActiveAssetCtxAtom>;
  updatedAt: number;
}): IPerpsActiveAssetCtxColdCacheAtom {
  if (!hasDisplayMarketPrice(data)) {
    return cache;
  }
  const current = cache[data.coin];
  if (current && current.updatedAt >= updatedAt) {
    return cache;
  }
  return limitColdCacheEntries({
    ...cache,
    [data.coin]: {
      data,
      updatedAt,
    },
  });
}

function shouldUpdateColdCacheEntry({
  entry,
  assetCtx,
  now,
}: {
  entry: IPerpsActiveAssetCtxColdCacheAtom[string] | undefined;
  assetCtx: NonNullable<IPerpsActiveAssetCtxAtom>;
  now: number;
}) {
  if (!entry) {
    return true;
  }
  if (
    now - entry.updatedAt <=
    PERPS_ACTIVE_ASSET_CTX_COLD_CACHE_MIN_WRITE_INTERVAL_MS
  ) {
    return false;
  }
  return (
    entry.data.ctx.markPrice !== assetCtx.ctx.markPrice ||
    entry.data.ctx.midPrice !== assetCtx.ctx.midPrice ||
    entry.data.ctx.fundingRate !== assetCtx.ctx.fundingRate ||
    entry.data.ctx.change24hPercent !== assetCtx.ctx.change24hPercent
  );
}

export function usePerpsActiveAssetCtxDisplay(coin?: string): {
  assetCtx: IPerpsActiveAssetCtxAtom;
  source: 'live' | 'coldCache' | 'staleCache' | 'empty';
  cacheAgeMs: number | undefined;
} {
  const [activeAsset] = usePerpsActiveAssetAtom();
  const [activeAssetCtx] = usePerpsActiveAssetCtxDisplayAtom();
  const [coldCache, setColdCache] = usePerpsActiveAssetCtxColdCacheAtom();
  const activeCoin = coin || activeAsset.coin;
  const cacheEntry = activeCoin ? coldCache[activeCoin] : undefined;

  useEffect(() => {
    if (!activeAssetCtx || !hasDisplayMarketPrice(activeAssetCtx)) {
      return;
    }
    const nextCoin = activeAssetCtx.coin;
    setColdCache((prev) => {
      const now = Date.now();
      const entry = prev[nextCoin];
      if (
        !shouldUpdateColdCacheEntry({
          entry,
          assetCtx: activeAssetCtx,
          now,
        })
      ) {
        return prev;
      }
      return limitColdCacheEntries({
        ...prev,
        [nextCoin]: {
          data: activeAssetCtx,
          updatedAt: now,
        },
      });
    });
  }, [activeAssetCtx, setColdCache]);

  if (
    isDisplayAssetCtx({
      assetCtx: activeAssetCtx,
      coin: activeCoin,
    })
  ) {
    return {
      assetCtx: activeAssetCtx,
      source: 'live',
      cacheAgeMs: undefined,
    };
  }

  const cacheAgeMs = cacheEntry?.updatedAt
    ? Date.now() - cacheEntry.updatedAt
    : undefined;
  const isFreshCache =
    cacheAgeMs !== undefined &&
    cacheAgeMs <= PERPS_ACTIVE_ASSET_CTX_COLD_CACHE_MAX_AGE_MS;
  if (
    isFreshCache &&
    isDisplayAssetCtx({
      assetCtx: cacheEntry?.data,
      coin: activeCoin,
    })
  ) {
    return {
      assetCtx: cacheEntry?.data,
      source: 'coldCache',
      cacheAgeMs,
    };
  }

  return {
    assetCtx: activeAssetCtx?.coin === activeCoin ? activeAssetCtx : undefined,
    source: cacheEntry ? 'staleCache' : 'empty',
    cacheAgeMs,
  };
}
