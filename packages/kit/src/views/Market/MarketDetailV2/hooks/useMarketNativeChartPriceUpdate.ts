import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';

import type { ITradingViewNativePriceUpdateData } from '@onekeyhq/kit/src/components/TradingView/TradingViewNative';
import {
  tokenDetailAtom,
  useMarketV2ContextData,
  useTokenDetailActions,
} from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';

export function useMarketNativeChartPriceUpdate({
  networkId,
  tokenAddress,
  enabled = true,
}: {
  networkId: string;
  tokenAddress: string;
  enabled?: boolean;
}) {
  const actions = useTokenDetailActions();
  const { store } = useMarketV2ContextData();
  const lastPriceUpdatedAtRef = useRef(0);
  const priceUpdateState = useMemo<{
    enabled: boolean;
    networkId: string;
    tokenAddress: string;
    hasAcceptedPrice: boolean;
    pendingPrice?: ITradingViewNativePriceUpdateData;
  }>(
    () => ({ enabled, networkId, tokenAddress, hasAcceptedPrice: false }),
    [enabled, networkId, tokenAddress],
  );
  const activePriceUpdateStateRef = useRef<typeof priceUpdateState | null>(
    null,
  );

  useLayoutEffect(() => {
    // Keep the committed chart active while a token switch is still rendering.
    activePriceUpdateStateRef.current = priceUpdateState;
    return () => {
      activePriceUpdateStateRef.current = null;
    };
  }, [priceUpdateState]);

  const applyChartPrice = useCallback(
    (data: ITradingViewNativePriceUpdateData) => {
      if (
        !enabled ||
        !networkId ||
        priceUpdateState !== activePriceUpdateStateRef.current
      ) {
        return;
      }

      const detail = store?.get(tokenDetailAtom());
      if (
        !detail ||
        !equalTokenNoCaseSensitive({
          token1: { networkId, contractAddress: tokenAddress },
          token2: {
            networkId: detail.networkId ?? networkId,
            contractAddress: detail.address ?? '',
          },
        })
      ) {
        // The chart can load before the detail request needed by the header.
        priceUpdateState.pendingPrice = data;
        return;
      }

      const detailUpdatedAt =
        typeof detail.lastUpdated === 'number' &&
        Number.isFinite(detail.lastUpdated)
          ? detail.lastUpdated
          : 0;
      // Header prices require strictly newer timestamps, even within one tick.
      lastPriceUpdatedAtRef.current = Math.max(
        Date.now(),
        data.receivedAt,
        lastPriceUpdatedAtRef.current + 1,
        detailUpdatedAt + 1,
      );
      priceUpdateState.pendingPrice = undefined;
      actions.current.applyChartPriceUpdate({
        networkId,
        tokenAddress,
        price: String(data.price),
        lastUpdated: lastPriceUpdatedAtRef.current,
      });
    },
    [actions, enabled, networkId, priceUpdateState, store, tokenAddress],
  );

  useEffect(() => {
    if (!store || !enabled || !networkId) {
      return;
    }

    const flushPendingPrice = () => {
      if (priceUpdateState.pendingPrice) {
        applyChartPrice(priceUpdateState.pendingPrice);
      }
    };
    // Replay the buffered price without subscribing the chart's render tree.
    const unsubscribe = store.sub(tokenDetailAtom(), flushPendingPrice);
    flushPendingPrice();
    return unsubscribe;
  }, [applyChartPrice, enabled, networkId, priceUpdateState, store]);

  return useCallback(
    (data: ITradingViewNativePriceUpdateData) => {
      if (
        !enabled ||
        !networkId ||
        priceUpdateState !== activePriceUpdateStateRef.current ||
        !Number.isFinite(data.price) ||
        data.price <= 0
      ) {
        return;
      }
      // Bootstrap once; later history must not replace an accepted live price.
      if (data.source === 'history' && priceUpdateState.hasAcceptedPrice) {
        return;
      }

      priceUpdateState.hasAcceptedPrice = true;
      applyChartPrice(data);
    },
    [applyChartPrice, enabled, networkId, priceUpdateState],
  );
}
