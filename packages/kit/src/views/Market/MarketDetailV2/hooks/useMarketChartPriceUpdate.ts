import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';

import {
  isNativeAtom,
  tokenDetailAtom,
  useMarketV2ContextData,
  useTokenDetailActions,
} from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';
import { isMarketChartPriceTarget } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2/marketTokenDetailPrice';

export type IMarketChartPriceSource = 'history' | 'realtime';

/**
 * Forwards chart quotes to the detail header for one token identity. Shared by
 * the Native chart and the TradingView web chart.
 *
 * - A quote that arrives before the matching detail is buffered and replayed.
 * - History seeds the header once; later history never replaces an accepted
 *   quote, even while buffering, so a late response cannot roll it back.
 * - Timestamps are strictly increasing so the header cache takes every tick.
 * - Callbacks from a previous identity, a route that lost ownership, or an
 *   unmounted chart are discarded.
 */
export function useMarketChartPriceUpdate({
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
  // One mutable record per identity and ownership. Callbacks captured by the
  // chart compare against the committed record, so an interrupted render or a
  // disabled route cannot write through a stale closure.
  const priceUpdateState = useMemo<{
    enabled: boolean;
    networkId: string;
    tokenAddress: string;
    hasAcceptedPrice: boolean;
    pendingPrice?: string;
  }>(
    () => ({ enabled, networkId, tokenAddress, hasAcceptedPrice: false }),
    [enabled, networkId, tokenAddress],
  );
  const activePriceUpdateStateRef = useRef<typeof priceUpdateState | null>(
    null,
  );

  useLayoutEffect(() => {
    activePriceUpdateStateRef.current = priceUpdateState;
    return () => {
      activePriceUpdateStateRef.current = null;
    };
  }, [priceUpdateState]);

  const applyChartPrice = useCallback(
    (price: string) => {
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
        !isMarketChartPriceTarget({
          tokenDetail: detail,
          networkId,
          tokenAddress,
          isNative: store?.get(isNativeAtom()),
        })
      ) {
        // The chart can load before the detail request needed by the header.
        priceUpdateState.pendingPrice = price;
        return;
      }

      const detailUpdatedAt =
        typeof detail.lastUpdated === 'number' &&
        Number.isFinite(detail.lastUpdated)
          ? detail.lastUpdated
          : 0;
      // The header cache requires strictly newer timestamps, including ticks
      // received in the same millisecond or carrying the same candle time.
      lastPriceUpdatedAtRef.current = Math.max(
        Date.now(),
        lastPriceUpdatedAtRef.current + 1,
        detailUpdatedAt + 1,
      );
      priceUpdateState.pendingPrice = undefined;
      actions.current.applyChartPriceUpdate({
        networkId,
        tokenAddress,
        price,
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
      if (priceUpdateState.pendingPrice !== undefined) {
        applyChartPrice(priceUpdateState.pendingPrice);
      }
    };
    // Replay the buffered price without subscribing the chart's render tree.
    const unsubscribe = store.sub(tokenDetailAtom(), flushPendingPrice);
    flushPendingPrice();
    return unsubscribe;
  }, [applyChartPrice, enabled, networkId, priceUpdateState, store]);

  return useCallback(
    (price: string, source: IMarketChartPriceSource) => {
      if (
        !enabled ||
        !networkId ||
        priceUpdateState !== activePriceUpdateStateRef.current
      ) {
        return;
      }
      if (source === 'history' && priceUpdateState.hasAcceptedPrice) {
        return;
      }

      priceUpdateState.hasAcceptedPrice = true;
      applyChartPrice(price);
    },
    [applyChartPrice, enabled, networkId, priceUpdateState],
  );
}
