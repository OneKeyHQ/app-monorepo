import { useCallback, useEffect, useMemo, useState } from 'react';

import { PERPS_RECENT_TRADES_LIMIT } from '@onekeyhq/shared/types/hyperliquid/perp.constants';
import type { IRecentTrade } from '@onekeyhq/shared/types/hyperliquid/sdk';

import {
  acquirePublicTradesHistory,
  getCompletedPublicTradesRecovery,
  mergePublicTrades,
  watchHyperliquidPublicTrades,
} from '../../../utils/watchHyperliquidPublicTrades';

import type { IPublicTradesEvidence } from '../../../utils/watchHyperliquidPublicTrades';

interface ITradesState {
  trades: IRecentTrade[];
  isLoading: boolean;
  error?: 'request' | 'gap';
  missingTrade?: IRecentTrade;
  isDisconnected: boolean;
}

const initialState: ITradesState = {
  trades: [],
  isLoading: true,
  isDisconnected: false,
};

const SNAPSHOT_FALLBACK_DELAY_MS = 1000;
const INITIAL_BATCH_ROWS = 20;
const INITIAL_BATCH_WAIT_MS = 600;

function tradeKey(trade: IRecentTrade) {
  return `${trade.time}:${trade.tid}`;
}

function findMissingTrade(
  rows: IRecentTrade[],
  { missingTrade }: IPublicTradesEvidence,
  fullLiveWindow: boolean,
) {
  if (fullLiveWindow || !missingTrade) return undefined;
  const retained = rows.some(
    (row) =>
      row.coin === missingTrade.coin &&
      row.time === missingTrade.time &&
      row.tid === missingTrade.tid,
  );
  return retained ? undefined : missingTrade;
}

export function usePerpPublicTrades(coin: string, active: boolean) {
  const session = useMemo(() => ({ coin, active }), [coin, active]);
  const [attempt, setAttempt] = useState<{
    session: typeof session;
    offline: boolean;
    missingTrade?: IRecentTrade;
    recovery?: Promise<boolean>;
  }>();
  const [state, setState] = useState(initialState);
  const [releasedSmallBatch, setReleasedSmallBatch] = useState(false);
  const retry = useCallback(() => {
    setState((previous) => ({ ...previous, isLoading: true }));
    setAttempt({
      session,
      offline: state.isDisconnected,
      missingTrade: state.missingTrade,
      recovery: getCompletedPublicTradesRecovery(coin),
    });
  }, [coin, session, state.isDisconnected, state.missingTrade]);

  useEffect(() => {
    if (!active) return;
    let disposed = false;
    let connected: boolean | undefined;
    let manualRetry = attempt?.session === session;
    let currentRequest: { reconnect: boolean } | undefined;
    const liveTradeKeys = new Set<string>();
    setState((previous) => ({ ...previous, isLoading: true }));
    const mergeRows = (
      incoming: IRecentTrade[],
      evidence: IPublicTradesEvidence,
      fullLiveWindow = false,
    ) => {
      const canAdoptRecovery = !manualRetry && evidence.recovered;
      setState((previous) => {
        const trades = mergePublicTrades(incoming, previous.trades);
        const gapFilled = previous.error === 'gap' && !previous.isLoading;
        const missingTrade = findMissingTrade(trades, evidence, fullLiveWindow);
        const settled =
          fullLiveWindow || ((canAdoptRecovery || gapFilled) && !missingTrade);
        return {
          ...previous,
          trades,
          missingTrade,
          ...(settled && { isLoading: false, error: undefined }),
        };
      });
    };
    const history = acquirePublicTradesHistory(
      coin,
      mergeRows,
      manualRetry ? attempt?.missingTrade : undefined,
    );
    const updateSnapshotStatus = (
      outcome: 'loading' | 'success' | 'failure',
    ) => {
      const evidence = history.evidence();
      const hasSnapshot =
        outcome === 'success' || (!manualRetry && evidence.recovered);
      const fullLiveWindow = liveTradeKeys.size === PERPS_RECENT_TRADES_LIMIT;
      setState((previous) => {
        const missingTrade = findMissingTrade(
          previous.trades,
          evidence,
          fullLiveWindow,
        );
        const covered = fullLiveWindow || (hasSnapshot && !missingTrade);
        if (outcome === 'loading')
          return { ...previous, isLoading: !covered, missingTrade };
        let error: ITradesState['error'];
        if (!covered) error = hasSnapshot ? 'gap' : 'request';
        return { ...previous, isLoading: false, error, missingTrade };
      });
    };
    const fetchSnapshot = async (reconnect: boolean) => {
      const request = { reconnect };
      currentRequest = request;
      updateSnapshotStatus('loading');
      try {
        const applied = await history.fetch(reconnect);
        if (!applied || disposed || currentRequest !== request) return;
        updateSnapshotStatus('success');
      } catch {
        if (disposed || currentRequest !== request) return;
        updateSnapshotStatus('failure');
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
        mergeRows(
          incoming,
          history.evidence(),
          liveTradeKeys.size === PERPS_RECENT_TRADES_LIMIT,
        );
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
          if (connected) history.disconnect();
          else if (manualRetry)
            history.discardCompletedRecovery(attempt?.recovery);
          if (currentRequest?.reconnect) {
            currentRequest = undefined;
            setState((previous) => ({ ...previous, isLoading: false }));
          }
          liveTradeKeys.clear();
        } else {
          const reconnect =
            connected === false || (manualRetry && !!attempt?.offline);
          if (reconnect && manualRetry) {
            history.discardCompletedRecovery(attempt?.recovery);
            manualRetry = false;
          }
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
  const isError = !!state.error;
  const hasStatus = isError || state.isDisconnected;
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
    isError,
    isDisconnected: state.isDisconnected,
    trades: holdFirstBatch ? initialState.trades : state.trades,
    isLoading: state.isLoading || holdFirstBatch,
    retry,
  };
}
