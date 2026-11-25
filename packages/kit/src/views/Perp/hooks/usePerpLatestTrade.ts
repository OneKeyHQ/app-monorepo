import { useCallback, useMemo, useSyncExternalStore } from 'react';

import type { IWsTrades } from '@onekeyhq/shared/types/hyperliquid/sdk';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import {
  getConnectedPublicTradesSnapshot,
  watchHyperliquidPublicTrades,
} from '../../../utils/watchHyperliquidPublicTrades';

const LATEST_TRADE_INTERACTIVE_MAX_AGE_MS = 30_000;
type ILatestTrade = IWsTrades[number];
type ILatestTradeSnapshot = {
  coin: string;
  trade: ILatestTrade;
  isLive: boolean;
};

function isLaterTrade(candidate: ILatestTrade, current: ILatestTrade) {
  return (
    candidate.time > current.time ||
    (candidate.time === current.time && candidate.tid > current.tid)
  );
}

function selectLatestTrade(trades: IWsTrades, coin: string) {
  return trades.reduce<ILatestTrade | undefined>((latest, trade) => {
    if (
      trade.coin !== coin ||
      !Number.isFinite(trade.time) ||
      !Number.isFinite(trade.tid) ||
      !Number.isFinite(Number(trade.px)) ||
      Number(trade.px) <= 0 ||
      (trade.side !== 'A' && trade.side !== 'B')
    ) {
      return latest;
    }
    return !latest || isLaterTrade(trade, latest) ? trade : latest;
  }, undefined);
}

// UI-runtime state shared by the ticker and book; the background feed remains
// owned by watchHyperliquidPublicTrades through backgroundApiProxy.
const stores = new Map<string, ReturnType<typeof createLatestTradeStore>>();

function createLatestTradeStore(coin: string) {
  let snapshot: ILatestTradeSnapshot | undefined;
  const listeners = new Set<() => void>();
  let activeConsumers = 0;
  let stop: (() => void) | undefined;
  let pausedAt: number | undefined;
  const notify = () => listeners.forEach((listener) => listener());
  const invalidate = () => {
    if (snapshot?.isLive) {
      snapshot = { ...snapshot, isLive: false };
      notify();
    }
  };
  const start = () => {
    let disposed = false;
    let connected = false;
    let needsReconnectBackfill = false;
    let acceptedLiveTrade = false;
    let connectionGeneration = 0;
    let expiryTimer: ReturnType<typeof setTimeout> | undefined;
    const publish = (trades: IWsTrades, fromSocket: boolean) => {
      if (disposed || (!fromSocket && acceptedLiveTrade)) return;
      const candidate = selectLatestTrade(trades, coin);
      if (!candidate || (snapshot && isLaterTrade(snapshot.trade, candidate))) {
        return;
      }
      const remaining =
        LATEST_TRADE_INTERACTIVE_MAX_AGE_MS - (Date.now() - candidate.time);
      const isLive = fromSocket && connected && remaining > 0;
      if (isLive) acceptedLiveTrade = true;
      snapshot = { coin, trade: candidate, isLive };
      clearTimeout(expiryTimer);
      if (isLive) expiryTimer = setTimeout(invalidate, remaining);
      notify();
    };
    const backfill = (request: Promise<IWsTrades>) => {
      const generation = connectionGeneration;
      void request
        .then((trades) => {
          if (generation === connectionGeneration) publish(trades, false);
        })
        .catch(() => {
          // The live subscription can still recover when the snapshot fails.
        });
    };
    const unwatch = watchHyperliquidPublicTrades({
      coin,
      limit: 1,
      onTrades: (trades) => publish(trades, true),
      onStatus: (status) => {
        if (disposed) return;
        connected = status === 'connected';
        if (!connected) {
          needsReconnectBackfill = true;
          acceptedLiveTrade = false;
          invalidate();
        } else if (needsReconnectBackfill) {
          needsReconnectBackfill = false;
          connectionGeneration += 1;
          backfill(getConnectedPublicTradesSnapshot(coin));
        }
      },
    });
    if (
      !snapshot ||
      (pausedAt !== undefined &&
        Date.now() - pausedAt >= LATEST_TRADE_INTERACTIVE_MAX_AGE_MS)
    ) {
      // Backfill after a pause, without replacing an eligible live trade.
      backfill(
        backgroundApiProxy.serviceHyperliquid.getPerpRecentTrades({ coin }),
      );
    }
    return () => {
      disposed = true;
      clearTimeout(expiryTimer);
      unwatch();
      pausedAt = Date.now();
      invalidate();
    };
  };
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void, active: boolean) {
      listeners.add(listener);
      if (active && coin) {
        activeConsumers += 1;
        if (activeConsumers === 1) stop = start();
      }
      return () => {
        listeners.delete(listener);
        if (active && coin) {
          activeConsumers -= 1;
          if (activeConsumers === 0) {
            stop?.();
            stop = undefined;
          }
        }
        if (listeners.size === 0) stores.delete(coin);
      };
    },
  };
}

export function usePerpLatestTrade(coin: string, active: boolean) {
  const store = useMemo(() => {
    const existing = stores.get(coin);
    if (existing) return existing;
    const created = createLatestTradeStore(coin);
    stores.set(coin, created);
    return created;
  }, [coin]);
  const subscribe = useCallback(
    (listener: () => void) => {
      stores.set(coin, store);
      return store.subscribe(listener, active);
    },
    [active, coin, store],
  );
  const current = useSyncExternalStore(
    subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );
  // Recheck at press time as a timer can be delayed while the JS thread is busy.
  const getSelectablePrice = useCallback(() => {
    if (
      !active ||
      !current?.isLive ||
      Date.now() - current.trade.time >= LATEST_TRADE_INTERACTIVE_MAX_AGE_MS
    ) {
      return undefined;
    }
    return current.trade.px;
  }, [active, current]);

  return {
    trade: current?.trade,
    isInteractive: active && !!current?.isLive,
    getSelectablePrice,
  };
}
