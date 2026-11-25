import { useEffect, useState } from 'react';

import { orderBy, uniqBy } from 'lodash';

import { LRUCache } from '@onekeyhq/shared/src/utils/cacheUtils';
import {
  PERPS_RECENT_TRADES_LIMIT,
  refreshPerpPublicTrades,
  registerPerpPublicTradesRefresh,
} from '@onekeyhq/shared/types/hyperliquid/perp.constants';
import type { IRecentTrade } from '@onekeyhq/shared/types/hyperliquid/sdk';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { watchHyperliquidPublicTrades } from '../../../utils/watchHyperliquidPublicTrades';

export { refreshPerpPublicTrades };

interface ITradesState {
  coin: string;
  trades: IRecentTrade[];
  isLoading: boolean;
  isError: boolean;
  isDisconnected: boolean;
}

const initialState: Omit<ITradesState, 'coin'> = {
  trades: [],
  isLoading: true,
  isError: false,
  isDisconnected: false,
};

const SNAPSHOT_FALLBACK_DELAY_MS = 1000;
const INITIAL_BATCH_ROWS = 20;
const INITIAL_BATCH_WAIT_MS = 600;
const recentTradesCache = new LRUCache<string, IRecentTrade[]>({
  max: 20,
  ttl: 5 * 60_000,
});

function getInitialState(coin: string): ITradesState {
  return { ...initialState, coin, trades: recentTradesCache.get(coin) ?? [] };
}

function tradeKey(trade: IRecentTrade) {
  return `${trade.time}:${trade.tid}`;
}

function latestTrades(incoming: IRecentTrade[], previous: IRecentTrade[]) {
  if (incoming.length === 0) return previous;
  const unique = uniqBy([...incoming, ...previous], tradeKey);
  return orderBy(unique, ['time', 'tid'], ['desc', 'desc']).slice(
    0,
    PERPS_RECENT_TRADES_LIMIT,
  );
}

export function usePerpPublicTrades(coin: string, active: boolean) {
  const [state, setState] = useState(() => getInitialState(coin));
  const [releasedSmallBatch, setReleasedSmallBatch] = useState(
    state.trades.length > 0,
  );
  if (state.coin !== coin) {
    const nextState = getInitialState(coin);
    setState(nextState);
    setReleasedSmallBatch(nextState.trades.length > 0);
  }
  useEffect(() => {
    if (state.trades.length > 0) {
      const cached = recentTradesCache.get(state.coin);
      if (cached !== state.trades) {
        recentTradesCache.set(
          state.coin,
          latestTrades(state.trades, cached ?? []),
        );
      }
    }
  }, [state.coin, state.trades]);
  useEffect(() => {
    if (!active) return;
    let disposed = false;
    let connected = false;
    let snapshotPending: Promise<void> | undefined;
    let backfillQueued = false;
    let snapshotRetryAttempt = 0;
    let snapshotRetryTimer: ReturnType<typeof setTimeout> | undefined;
    const liveTradeKeys = new Set<string>();
    setState((previous) => ({ ...previous, isLoading: true }));
    const fetchSnapshotOnce = async () => {
      clearTimeout(snapshotRetryTimer);
      setState((previous) => ({
        ...previous,
        isLoading: liveTradeKeys.size < PERPS_RECENT_TRADES_LIMIT,
      }));
      try {
        const snapshot =
          await backgroundApiProxy.serviceHyperliquid.getPerpRecentTrades({
            coin,
          });
        if (disposed) return;
        snapshotRetryAttempt = 0;
        const incoming = snapshot.filter((trade) => trade.coin === coin);
        setState((previous) => ({
          ...previous,
          trades: latestTrades(incoming, previous.trades),
          isLoading: false,
          isError: false,
        }));
      } catch {
        if (disposed) return;
        const isError = liveTradeKeys.size < PERPS_RECENT_TRADES_LIMIT;
        setState((previous) => ({
          ...previous,
          isLoading: false,
          isError,
        }));
        if (isError) {
          snapshotRetryTimer = setTimeout(
            () => void fetchSnapshot(),
            Math.min(1000 * 2 ** snapshotRetryAttempt, 30_000),
          );
          snapshotRetryAttempt += 1;
        }
      }
    };

    function fetchSnapshot(backfill = false): Promise<void> {
      if (snapshotPending) {
        backfillQueued ||= backfill;
        return snapshotPending;
      }
      snapshotPending = (async () => {
        do {
          backfillQueued = false;
          await fetchSnapshotOnce();
          if (disposed) break;
        } while (backfillQueued);
      })().finally(() => {
        snapshotPending = undefined;
      });
      return snapshotPending;
    }

    // After the subscription is acknowledged, the snapshot and live feed overlap.
    // A slow or unavailable socket can still display an initial HTTP snapshot.
    const fallbackTimer = setTimeout(
      () => void fetchSnapshot(),
      SNAPSHOT_FALLBACK_DELAY_MS,
    );
    const subscribe = () =>
      watchHyperliquidPublicTrades({
        coin,
        limit: PERPS_RECENT_TRADES_LIMIT,
        onTrades: (incoming) => {
          if (disposed) return;
          const matchingTrades = incoming.filter(
            (trade) => trade.coin === coin,
          );
          for (const trade of matchingTrades) {
            if (liveTradeKeys.size === PERPS_RECENT_TRADES_LIMIT) break;
            liveTradeKeys.add(tradeKey(trade));
          }
          const fullLiveWindow =
            liveTradeKeys.size === PERPS_RECENT_TRADES_LIMIT;
          if (fullLiveWindow) clearTimeout(snapshotRetryTimer);
          setState((previous) => ({
            ...previous,
            trades: latestTrades(matchingTrades, previous.trades),
            ...(fullLiveWindow && { isError: false, isLoading: false }),
          }));
        },
        onStatus: (status) => {
          if (disposed) return;
          const isDisconnected = status !== 'connected';
          setState((previous) =>
            previous.isDisconnected === isDisconnected
              ? previous
              : { ...previous, isDisconnected },
          );
          if (isDisconnected) {
            liveTradeKeys.clear();
          } else if (!connected) {
            clearTimeout(fallbackTimer);
            void fetchSnapshot(true);
          }
          connected = !isDisconnected;
        },
      });
    let unwatch = subscribe();
    const unregisterRefresh = registerPerpPublicTradesRefresh(async () => {
      clearTimeout(fallbackTimer);
      snapshotRetryAttempt = 0;
      if (!connected) {
        unwatch();
        unwatch = subscribe();
      }
      await fetchSnapshot();
    });
    return () => {
      disposed = true;
      unregisterRefresh();
      clearTimeout(fallbackTimer);
      clearTimeout(snapshotRetryTimer);
      unwatch();
    };
  }, [coin, active]);

  const smallBatch =
    state.trades.length > 0 && state.trades.length < INITIAL_BATCH_ROWS;
  const hasStatus = state.isError || state.isDisconnected;
  useEffect(() => {
    if (!smallBatch || releasedSmallBatch) return;
    if (hasStatus) {
      setReleasedSmallBatch(true);
      return;
    }
    // Give the other source a chance to fill the first screen on a cold entry.
    const timer = setTimeout(
      () => setReleasedSmallBatch(true),
      INITIAL_BATCH_WAIT_MS,
    );
    return () => clearTimeout(timer);
  }, [smallBatch, releasedSmallBatch, hasStatus]);

  const holdFirstBatch = smallBatch && !releasedSmallBatch && !hasStatus;
  return {
    ...state,
    trades: holdFirstBatch ? initialState.trades : state.trades,
    isLoading: state.isLoading || holdFirstBatch,
  };
}
