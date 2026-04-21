import { useMemo } from 'react';

import BigNumber from 'bignumber.js';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useActiveTradeInstrumentAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { usePerpsAllAssetCtxsAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/atoms';
import { useSpotAssetCtxsMapAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  formatSpotPairDisplayName,
  parseDexCoin,
} from '@onekeyhq/shared/src/utils/perpsUtils';
import type {
  IPerpsUniverse,
  ISpotUniverse,
} from '@onekeyhq/shared/types/hyperliquid';
import { XYZ_ASSET_ID_OFFSET } from '@onekeyhq/shared/types/hyperliquid/perp.constants';

import { usePromiseResult } from '../../../hooks/usePromiseResult';

const POPULAR_TICKER_COUNT = 10;

export interface IPopularTickerItem {
  mode: 'perp' | 'spot';
  coinName: string;
  displayName: string;
  imageTokenName: string;
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
  const [activeTradeInstrument] = useActiveTradeInstrumentAtom();
  const [allAssetCtxs] = usePerpsAllAssetCtxsAtom();
  const [spotPriceMap] = useSpotAssetCtxsMapAtom();
  const mode = activeTradeInstrument.mode;

  // Must not read from search-filtered atom — popular tickers would disappear
  // during search. Tagged with mode because usePromiseResult keeps the old
  // result until the new promise resolves.
  const { result: taggedUniverse } = usePromiseResult(
    async (): Promise<
      | { mode: 'spot'; data: ISpotUniverse[] }
      | { mode: 'perp'; data: IPerpsUniverse[][] }
    > => {
      if (mode === 'spot') {
        let { universes } =
          await backgroundApiProxy.serviceHyperliquid.getSpotMeta();

        if (!universes?.length) {
          await backgroundApiProxy.serviceHyperliquid.refreshSpotMeta();
          const res = await backgroundApiProxy.serviceHyperliquid.getSpotMeta();
          universes = res.universes;
        }

        return { mode: 'spot', data: universes ?? [] };
      }

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

      return { mode: 'perp', data: universesByDex ?? [] };
    },
    [mode],
    { checkIsFocused: false },
  );

  return useMemo(() => {
    if (!taggedUniverse || taggedUniverse.mode !== mode) return [];

    if (mode === 'spot' && taggedUniverse.mode === 'spot') {
      const spotUniverses = taggedUniverse.data;
      if (!spotUniverses?.length) {
        return [];
      }

      const scored = spotUniverses
        .map((asset) => {
          const ctx = spotPriceMap[asset.name];
          const volume24h = new BigNumber(ctx?.dayNtlVlm ?? '0');
          const markPrice = new BigNumber(ctx?.markPx ?? '0');
          const circulatingSupply = new BigNumber(
            ctx?.circulatingSupply ?? '0',
          );
          const hotScore = volume24h.toNumber();
          const marketCap = circulatingSupply
            .multipliedBy(markPrice)
            .toNumber();

          return {
            mode: 'spot' as const,
            coinName: asset.name,
            displayName:
              asset.displayName ||
              formatSpotPairDisplayName(asset.baseName, asset.quoteName),
            imageTokenName: asset.baseName,
            assetId: asset.assetId,
            dexIndex: -1,
            hotScore: Number.isFinite(hotScore) ? hotScore : 0,
            marketCap,
          };
        })
        .filter((item) => item.hotScore > 0 || item.marketCap > 0);

      scored.sort(
        (a, b) => b.hotScore - a.hotScore || b.marketCap - a.marketCap,
      );
      return scored
        .slice(0, POPULAR_TICKER_COUNT)
        .map(({ marketCap, ...item }) => item);
    }

    const { assetCtxsByDex } = allAssetCtxs;

    const perpUniverse = taggedUniverse.data;
    if (!assetCtxsByDex.length || !perpUniverse?.length) return [];
    const scored: IPopularTickerItem[] = [];

    for (let dexIndex = 0; dexIndex < perpUniverse.length; dexIndex += 1) {
      const assets = perpUniverse[dexIndex] ?? [];
      const ctxs = assetCtxsByDex[dexIndex] ?? [];
      if (Array.isArray(assets)) {
        for (const asset of assets) {
          // XYZ DEX assets have offset IDs; array is indexed from 0
          const ctxIndex =
            dexIndex === 1
              ? asset.assetId - XYZ_ASSET_ID_OFFSET
              : asset.assetId;
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
                  mode: 'perp',
                  coinName: asset.name,
                  displayName: parsed.displayName,
                  imageTokenName: parsed.displayName,
                  assetId: asset.assetId,
                  dexIndex,
                  hotScore,
                });
              }
            }
          }
        }
      }
    }

    scored.sort((a, b) => b.hotScore - a.hotScore);
    return scored.slice(0, POPULAR_TICKER_COUNT);
  }, [allAssetCtxs, mode, spotPriceMap, taggedUniverse]);
}
