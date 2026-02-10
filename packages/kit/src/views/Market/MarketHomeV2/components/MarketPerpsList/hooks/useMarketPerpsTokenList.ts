import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type { IPerpDynamicTab } from '@onekeyhq/kit-bg/src/services/ServiceWebviewPerp/ServiceWebviewPerp';
import { usePerpTokenSelectorTabsAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  getHyperliquidTokenImageUrl,
  getTokenSubtitle,
  parseDexCoin,
} from '@onekeyhq/shared/src/utils/perpsUtils';
import type { ITokenSearchAliases } from '@onekeyhq/shared/src/utils/perpsUtils';
import type {
  IPerpsAssetCtx,
  IPerpsUniverse,
  IWsAllDexsAssetCtxs,
} from '@onekeyhq/shared/types/hyperliquid';
import { ESubscriptionType } from '@onekeyhq/shared/types/hyperliquid/types';

export interface IMarketPerpsToken {
  name: string;
  displayName: string;
  dexLabel?: string;
  assetId: number;
  maxLeverage: number;
  subtitle?: string;
  tokenImageUrl: string;
  // Real-time data from WS (undefined = loading)
  markPrice?: string;
  prevDayPrice?: string;
  change24hPercent?: number;
  volume24h?: string;
  openInterest?: string;
  fundingRate?: string;
}

interface IUseMarketPerpsTokenListParams {
  selectedCategoryId: string;
}

function mergeTokenData(
  universe: IPerpsUniverse,
  assetCtx: IPerpsAssetCtx | undefined,
  tokenSearchAliases: ITokenSearchAliases | undefined,
): IMarketPerpsToken {
  const { displayName, dexLabel } = parseDexCoin(universe.name);
  const subtitle = getTokenSubtitle(universe.name, tokenSearchAliases);
  const tokenImageUrl = getHyperliquidTokenImageUrl(displayName);

  let change24hPercent: number | undefined;
  let openInterestUsd: string | undefined;
  if (assetCtx) {
    const markPx = Number(assetCtx.markPx);
    const prevDayPx = Number(assetCtx.prevDayPx);
    if (prevDayPx !== 0) {
      change24hPercent = ((markPx - prevDayPx) / prevDayPx) * 100;
    }
    if (assetCtx.openInterest) {
      openInterestUsd = String(Number(assetCtx.openInterest) * markPx);
    }
  }

  return {
    name: universe.name,
    displayName,
    dexLabel,
    assetId: universe.assetId,
    maxLeverage: universe.maxLeverage,
    subtitle,
    tokenImageUrl,
    markPrice: assetCtx?.markPx,
    prevDayPrice: assetCtx?.prevDayPx,
    change24hPercent,
    volume24h: assetCtx?.dayNtlVlm,
    openInterest: openInterestUsd,
    fundingRate: assetCtx?.funding,
  };
}

export function useMarketPerpsTokenList({
  selectedCategoryId,
}: IUseMarketPerpsTokenListParams) {
  const [tabs] = usePerpTokenSelectorTabsAtom();
  const [assetCtxsByDex, setAssetCtxsByDex] = useState<IPerpsAssetCtx[][]>([]);
  const latestCtxsRef = useRef<IPerpsAssetCtx[][]>([]);
  const isSubscribedRef = useRef(false);

  // Load static metadata from simpleDb
  const { result: staticData, isLoading: isLoadingMeta } = usePromiseResult(
    async () => {
      const { universesByDex } =
        await backgroundApiProxy.serviceHyperliquid.getTradingUniverse();
      const tokenSearchAliases =
        await backgroundApiProxy.serviceHyperliquid.getTokenSearchAliases();

      // If universes are empty, trigger a refresh
      if (!universesByDex || universesByDex.length === 0) {
        await backgroundApiProxy.serviceHyperliquid.refreshTradingMeta();
        const refreshed =
          await backgroundApiProxy.serviceHyperliquid.getTradingUniverse();
        return {
          universesByDex: refreshed.universesByDex,
          tokenSearchAliases,
        };
      }

      return { universesByDex, tokenSearchAliases };
    },
    [],
    { pollingInterval: 5 * 60 * 1000 },
  );

  // WS lifecycle: request/release market subscriptions
  useEffect(() => {
    void backgroundApiProxy.serviceHyperliquidSubscription.requestMarketSubscriptions();
    isSubscribedRef.current = true;
    return () => {
      isSubscribedRef.current = false;
      void backgroundApiProxy.serviceHyperliquidSubscription.releaseMarketSubscriptions();
    };
  }, []);

  // Listen to WS events for real-time price data (throttled to avoid render storms)
  useEffect(() => {
    const handleDataUpdate = (payload: unknown) => {
      const eventPayload = payload as {
        subType: ESubscriptionType;
        data: unknown;
      };
      if (eventPayload.subType === ESubscriptionType.ALL_DEXS_ASSET_CTXS) {
        const wsData = eventPayload.data as IWsAllDexsAssetCtxs;
        const incoming = wsData?.ctxs || [];
        const ctxMap = new Map<string, IPerpsAssetCtx[]>();
        incoming.forEach(([dexName, ctxList]) => {
          ctxMap.set(dexName, ctxList || []);
        });
        const ctxsByDex: IPerpsAssetCtx[][] = [];
        ctxsByDex[0] = ctxMap.get('') ?? ctxMap.get('perps') ?? [];
        ctxsByDex[1] = ctxMap.get('xyz') ?? [];
        // Store in ref (no re-render), flushed by interval below
        latestCtxsRef.current = ctxsByDex;
      }
    };

    appEventBus.on(EAppEventBusNames.HyperliquidDataUpdate, handleDataUpdate);

    // Flush ref → state every 3 seconds to keep UI responsive
    const flushInterval = setInterval(() => {
      if (latestCtxsRef.current.length > 0) {
        setAssetCtxsByDex(latestCtxsRef.current);
      }
    }, 3000);

    return () => {
      appEventBus.off(
        EAppEventBusNames.HyperliquidDataUpdate,
        handleDataUpdate,
      );
      clearInterval(flushInterval);
    };
  }, []);

  // Build category filter set
  const categoryTokenSet = useMemo(() => {
    if (!selectedCategoryId || selectedCategoryId === 'all') {
      return null; // show all
    }
    const tab = tabs?.find((t) => t.tabId === selectedCategoryId);
    if (!tab) return null;
    return new Set(tab.tokens);
  }, [tabs, selectedCategoryId]);

  // Merge and filter tokens
  const tokens = useMemo(() => {
    const universesByDex = staticData?.universesByDex;
    if (!universesByDex || universesByDex.length === 0) return [];

    // Only use dex index 0 (HyperLiquid main)
    const universes = universesByDex[0] ?? [];
    const ctxs = assetCtxsByDex[0] ?? [];

    const result: IMarketPerpsToken[] = [];
    for (let i = 0; i < universes.length; i += 1) {
      const universe = universes[i];
      if (
        !universe.isDelisted &&
        (!categoryTokenSet || categoryTokenSet.has(universe.name))
      ) {
        const assetCtx = ctxs[i];
        result.push(
          mergeTokenData(universe, assetCtx, staticData?.tokenSearchAliases),
        );
      }
    }

    // Sort by volume descending (default)
    result.sort((a, b) => {
      const aVol = Number(a.volume24h || 0);
      const bVol = Number(b.volume24h || 0);
      return bVol - aVol;
    });

    return result;
  }, [staticData, assetCtxsByDex, categoryTokenSet]);

  const isLoading = isLoadingMeta;
  const hasRealTimeData = assetCtxsByDex.length > 0;

  const categories: IPerpDynamicTab[] = useMemo(() => tabs ?? [], [tabs]);

  const refreshTradingMeta = useCallback(async () => {
    await backgroundApiProxy.serviceHyperliquid.refreshTradingMeta();
  }, []);

  return {
    tokens,
    categories,
    isLoading,
    hasRealTimeData,
    refreshTradingMeta,
  };
}
