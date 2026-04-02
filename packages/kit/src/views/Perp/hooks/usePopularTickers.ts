import { useMemo } from 'react';

import BigNumber from 'bignumber.js';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePerpsAllAssetCtxsAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/atoms';
import { parseDexCoin } from '@onekeyhq/shared/src/utils/perpsUtils';
import { XYZ_ASSET_ID_OFFSET } from '@onekeyhq/shared/types/hyperliquid/perp.constants';

import { usePromiseResult } from '../../../hooks/usePromiseResult';

const POPULAR_TICKER_COUNT = 10;

export interface IPopularTickerItem {
  coinName: string;
  displayName: string;
  assetId: number;
  dexIndex: number;
  hotScore: number;
}

/**
 * Computes top popular tickers ranked by turnover rate:
 * hotScore = dayNtlVlm / (openInterest * markPx)
 *
 * Higher score means more active trading relative to open interest.
 * Uses the full universe (not search-filtered) to avoid popular tickers
 * disappearing when the user types in the token search bar.
 */
export function usePopularTickers(): IPopularTickerItem[] {
  const [allAssetCtxs] = usePerpsAllAssetCtxsAtom();

  // Fetch the full universe independently — must not read from the
  // search-filtered atom, otherwise popular tickers disappear during search.
  const { result: universe } = usePromiseResult(
    async () => {
      let { universesByDex } =
        await backgroundApiProxy.serviceHyperliquid.getTradingUniverse();

      if (
        !universesByDex ||
        universesByDex.length === 0 ||
        universesByDex.every((u) => u.length === 0)
      ) {
        await backgroundApiProxy.serviceHyperliquid.refreshTradingMeta();
        const res =
          await backgroundApiProxy.serviceHyperliquid.getTradingUniverse();
        universesByDex = res.universesByDex;
      }

      return universesByDex ?? [];
    },
    [],
    { checkIsFocused: false },
  );

  return useMemo(() => {
    const { assetCtxsByDex } = allAssetCtxs;

    if (!assetCtxsByDex.length || !universe?.length) return [];

    const scored: IPopularTickerItem[] = [];

    for (let dexIndex = 0; dexIndex < universe.length; dexIndex += 1) {
      const assets = universe[dexIndex] ?? [];
      const ctxs = assetCtxsByDex[dexIndex] ?? [];

      for (const asset of assets) {
        // XYZ DEX assets have offset IDs; array is indexed from 0
        const ctxIndex =
          dexIndex === 1 ? asset.assetId - XYZ_ASSET_ID_OFFSET : asset.assetId;
        const ctx = ctxs[ctxIndex] ?? null;
        if (ctx) {
          const volume = new BigNumber(ctx.dayNtlVlm ?? '0');
          const oi = new BigNumber(ctx.openInterest ?? '0');
          const price = new BigNumber(ctx.markPx ?? '0');
          const denominator = oi.multipliedBy(price);

          if (!denominator.isZero() && denominator.isFinite()) {
            const hotScore = volume.dividedBy(denominator).toNumber();
            if (Number.isFinite(hotScore) && hotScore > 0) {
              const parsed = parseDexCoin(asset.name);
              scored.push({
                coinName: asset.name,
                displayName: parsed.displayName,
                assetId: asset.assetId,
                dexIndex,
                hotScore,
              });
            }
          }
        }
      }
    }

    scored.sort((a, b) => b.hotScore - a.hotScore);
    return scored.slice(0, POPULAR_TICKER_COUNT);
  }, [allAssetCtxs, universe]);
}
