import { useCallback, useEffect, useMemo, useState } from 'react';

import { PERPS_RECENT_TRADES_LIMIT } from '@onekeyhq/shared/types/hyperliquid/perp.constants';
import type { IRecentTrade } from '@onekeyhq/shared/types/hyperliquid/sdk';

import {
  acquirePublicTradesHistory,
  mergePublicTrades,
  watchHyperliquidPublicTrades,
} from '../../../utils/watchHyperliquidPublicTrades';

interface ITradesState {
  trades: IRecentTrade[];
  isLoading: boolean;
  isError: boolean;
  isDisconnected: boolean;
}

const initialState: ITradesState = {
  trades: [],
  isLoading: true,
  isError: false,
  isDisconnected: false,
};

const SNAPSHOT_FALLBACK_DELAY_MS = 1000;
const INITIAL_BATCH_ROWS = 20;
const INITIAL_BATCH_WAIT_MS = 600;

function tradeKey(trade: IRecentTrade) {
  return `${trade.time}:${trade.tid}`;
}

export function usePerpPublicTrades(coin: string, active: boolean) {
  const session = useMemo(() => ({ coin, active }), [coin, active]);
  const [attempt, setAttempt] = useState<{ session: typeof session }>();
  const [state, setState] = useState(initialState);
  const [releasedSmallBatch, setReleasedSmallBatch] = useState(false);
  const retry = useCallback(() => {
    setState((previous) => ({ ...previous, isLoading: true }));
    setAttempt({ session });
  }, [session]);

  useEffect(() => {
    if (!active) return;
    let disposed = false;
    let connected: boolean | undefined;
    let manualRetry = attempt?.session === session;
    let currentRequest: { reconnect: boolean } | undefined;
    const liveTradeKeys = new Set<string>();
    setState((previous) => ({ ...previous, isLoading: true }));
    const history = acquirePublicTradesHistory(coin, (incoming, recovered) => {
      const settle = recovered && !manualRetry;
      setState((previous) => ({
        ...previous,
        trades: mergePublicTrades(incoming, previous.trades),
        ...(settle && { isLoading: false, isError: false }),
      }));
    });
    const needsSnapshot = () =>
      liveTradeKeys.size < PERPS_RECENT_TRADES_LIMIT &&
      (manualRetry || !history.recovered);
    const fetchSnapshot = async (reconnect: boolean) => {
      const request = { reconnect };
      currentRequest = request;
      const isLoading = needsSnapshot();
      setState((previous) => ({ ...previous, isLoading }));
      try {
        const applied = await history.fetch(reconnect);
        if (!applied || disposed || currentRequest !== request) return;
        const isError =
          liveTradeKeys.size < PERPS_RECENT_TRADES_LIMIT &&
          !history.coversJoin();
        setState((previous) => ({
          ...previous,
          isLoading: false,
          isError,
        }));
      } catch {
        if (disposed || currentRequest !== request) return;
        const isError = needsSnapshot();
        setState((previous) => ({
          ...previous,
          isLoading: false,
          isError,
        }));
      } finally {
        if (currentRequest === request) currentRequest = undefined;
      }
    };

    // After the subscription is acknowledged, the snapshot and live feed overlap.
    // A slow or unavailable socket can still display an initial HTTP snapshot.
    const fallbackTimer = setTimeout(
      () => void fetchSnapshot(false),
      SNAPSHOT_FALLBACK_DELAY_MS,
    );
    const unwatch = watchHyperliquidPublicTrades({
      coin,
      limit: PERPS_RECENT_TRADES_LIMIT,
      onTrades: (incoming, displayOnly) => {
        if (!displayOnly) {
          for (const trade of incoming) {
            if (liveTradeKeys.size === PERPS_RECENT_TRADES_LIMIT) break;
            liveTradeKeys.add(tradeKey(trade));
          }
        }
        const fullLiveWindow = liveTradeKeys.size === PERPS_RECENT_TRADES_LIMIT;
        setState((previous) => ({
          ...previous,
          trades: mergePublicTrades(incoming, previous.trades),
          ...(fullLiveWindow && { isError: false, isLoading: false }),
        }));
      },
      onStatus: (status) => {
        const isDisconnected = status !== 'connected';
        if (connected === !isDisconnected) return;
        setState((previous) =>
          previous.isDisconnected === isDisconnected
            ? previous
            : { ...previous, isDisconnected },
        );
        if (isDisconnected) {
          // The first offline notification samples the connection. It must not
          // invalidate another watcher's in-flight recovery on this generation.
          if (connected || manualRetry) history.disconnect(!connected);
          if (currentRequest?.reconnect) {
            currentRequest = undefined;
            setState((previous) => ({ ...previous, isLoading: false }));
          }
          liveTradeKeys.clear();
        } else {
          const reconnect = connected === false;
          if (reconnect) manualRetry = false;
          clearTimeout(fallbackTimer);
          void fetchSnapshot(reconnect);
        }
        connected = !isDisconnected;
      },
    });
    return () => {
      disposed = true;
      clearTimeout(fallbackTimer);
      history.release();
      unwatch();
    };
  }, [coin, active, attempt, session]);

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
    retry,
  };
}
