import { useCallback, useEffect, useState } from 'react';

import { orderBy, uniqBy } from 'lodash';

import { PERPS_RECENT_TRADES_LIMIT } from '@onekeyhq/shared/types/hyperliquid/perp.constants';
import type { IRecentTrade } from '@onekeyhq/shared/types/hyperliquid/sdk';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { watchHyperliquidPublicTrades } from '../../../utils/watchHyperliquidPublicTrades';

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

function latestTrades(incoming: IRecentTrade[], previous: IRecentTrade[]) {
  const unique = uniqBy([...incoming, ...previous], tradeKey);
  return orderBy(unique, ['time', 'tid'], ['desc', 'desc']).slice(
    0,
    PERPS_RECENT_TRADES_LIMIT,
  );
}

export function usePerpPublicTrades(coin: string, active: boolean) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState(initialState);
  const [releasedSmallBatch, setReleasedSmallBatch] = useState(false);
  const retry = useCallback(() => {
    setState((previous) => ({ ...previous, isLoading: true }));
    setAttempt((previous) => previous + 1);
  }, []);

  useEffect(() => {
    if (!active) return;
    let disposed = false;
    let connected = false;
    let readRetainedTrades = false;
    let snapshotId = 0;
    const liveTradeKeys = new Set<string>();
    setState((previous) => ({ ...previous, isLoading: true }));
    const fetchSnapshot = async () => {
      snapshotId += 1;
      const id = snapshotId;
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
        const incoming = snapshot.filter((trade) => trade.coin === coin);
        setState((previous) => ({
          ...previous,
          trades: latestTrades(incoming, previous.trades),
          // An earlier fallback can still supply trades while a newer backfill owns the status.
          isLoading: id === snapshotId ? false : previous.isLoading,
          isError: id === snapshotId ? false : previous.isError,
        }));
      } catch {
        if (disposed || id !== snapshotId) return;
        const isError = liveTradeKeys.size < PERPS_RECENT_TRADES_LIMIT;
        setState((previous) => ({
          ...previous,
          isLoading: false,
          isError,
        }));
      }
    };

    // After the subscription is acknowledged, the snapshot and live feed overlap.
    // A slow or unavailable socket can still display an initial HTTP snapshot.
    const fallbackTimer = setTimeout(
      () => void fetchSnapshot(),
      SNAPSHOT_FALLBACK_DELAY_MS,
    );
    const unwatch = watchHyperliquidPublicTrades({
      coin,
      limit: PERPS_RECENT_TRADES_LIMIT,
      onTrades: (incoming) => {
        for (const trade of incoming) {
          if (liveTradeKeys.size === PERPS_RECENT_TRADES_LIMIT) break;
          liveTradeKeys.add(tradeKey(trade));
        }
        const fullLiveWindow = liveTradeKeys.size === PERPS_RECENT_TRADES_LIMIT;
        setState((previous) => ({
          ...previous,
          trades: latestTrades(incoming, previous.trades),
          ...(fullLiveWindow && { isError: false, isLoading: false }),
        }));
      },
      onStatus: (status) => {
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
          void fetchSnapshot();
          if (!readRetainedTrades) {
            readRetainedTrades = true;
            void backgroundApiProxy.serviceHyperliquidSubscription
              .getRetainedPublicTrades({ coin })
              .then((trades) => {
                if (disposed || !trades.length) return;
                setState((previous) => ({
                  ...previous,
                  trades: latestTrades(trades, previous.trades),
                }));
              })
              .catch(() => {
                // The HTTP snapshot and live feed can still populate the tape.
              });
          }
        }
        connected = !isDisconnected;
      },
    });
    return () => {
      disposed = true;
      clearTimeout(fallbackTimer);
      unwatch();
    };
  }, [coin, active, attempt]);

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
