import { useEffect, useRef, useState } from 'react';

import { LRUCache } from '@onekeyhq/shared/src/utils/cacheUtils';
import { PERPS_RECENT_TRADES_LIMIT } from '@onekeyhq/shared/types/hyperliquid/perp.constants';
import type { IRecentTrade } from '@onekeyhq/shared/types/hyperliquid/sdk';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import {
  acquirePublicTradesHistory,
  isLaterTrade,
  mergePublicTrades,
  watchHyperliquidPublicTrades,
} from '../../../utils/watchHyperliquidPublicTrades';

import type { IPublicTradesEvidence } from '../../../utils/watchHyperliquidPublicTrades';

// Callbacks live in the UI runtime and are registered only by active feeds.
const refreshers = new Set<{
  refresh: () => Promise<void>;
  pending?: Promise<void>;
}>();

function registerPerpPublicTradesRefresh(refresh: () => Promise<void>) {
  let release = () => {};
  const disposed = new Promise<void>((resolve) => {
    release = resolve;
  });
  const entry = { refresh: () => Promise.race([refresh(), disposed]) };
  refreshers.add(entry);
  return () => {
    refreshers.delete(entry);
    release();
  };
}

export async function refreshPerpPublicTrades() {
  await Promise.all(
    [...refreshers].map((entry) => {
      entry.pending ??= entry.refresh().finally(() => {
        entry.pending = undefined;
      });
      return entry.pending;
    }),
  );
}

interface ITradesState {
  coin: string;
  trades: IRecentTrade[];
  isLoading: boolean;
  error?: 'request' | 'gap';
  retryAttempt: number;
  missingTrade?: IRecentTrade;
  isDisconnected: boolean;
}

const initialState: Omit<ITradesState, 'coin'> = {
  trades: [],
  retryAttempt: 0,
  isLoading: true,
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

function findMissingTrade(
  rows: IRecentTrade[],
  missingTrade: IRecentTrade | undefined,
  { tip }: IPublicTradesEvidence,
  fullLiveWindow: boolean,
) {
  if (
    !missingTrade ||
    fullLiveWindow ||
    (tip && !isLaterTrade(missingTrade, tip))
  )
    return undefined;
  const retained = rows.some(
    (row) =>
      row.coin === missingTrade.coin &&
      row.time === missingTrade.time &&
      row.tid === missingTrade.tid,
  );
  return retained ? undefined : missingTrade;
}

export function usePerpPublicTrades(coin: string, active: boolean) {
  const retryHttp = useRef<(() => void) | undefined>(undefined);
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
          mergePublicTrades(state.trades, cached ?? []),
        );
      }
    }
  }, [state.coin, state.trades]);
  useEffect(() => {
    if (!active) return;
    let disposed = false;
    let connected: boolean | undefined;
    let manualRetry = false;
    let snapshotPending: Promise<void> | undefined;
    let requestVersion = 0;
    let snapshotQueued: 'fetch' | 'reconnect' | undefined;
    let releasePending: ((successor?: Promise<void>) => void) | undefined;
    const liveTradeKeys = new Set<string>();
    setState((previous) => ({ ...previous, isLoading: true }));
    const mergeRows = (
      incoming: IRecentTrade[],
      evidence: IPublicTradesEvidence,
      observedAtJoin?: IRecentTrade,
      retained = false,
    ) => {
      const canAdoptRecovery = !manualRetry && evidence.recovered;
      const fullLiveWindow = liveTradeKeys.size === PERPS_RECENT_TRADES_LIMIT;
      setState((previous) => {
        let trades = mergePublicTrades(incoming, previous.trades);
        // An unchanged retained window must not renew the UI cache TTL.
        if (
          retained &&
          trades.length === previous.trades.length &&
          trades.every(
            (trade, index) =>
              tradeKey(trade) === tradeKey(previous.trades[index]),
          )
        ) {
          trades = previous.trades;
        }
        const gapFilled = previous.error === 'gap' && !previous.isLoading;
        const missingTrade = findMissingTrade(
          trades,
          observedAtJoin ?? previous.missingTrade,
          evidence,
          fullLiveWindow,
        );
        const settled =
          fullLiveWindow || ((canAdoptRecovery || gapFilled) && !missingTrade);
        return {
          ...previous,
          trades,
          missingTrade,
          ...(settled && {
            isLoading: false,
            error: undefined,
            retryAttempt: 0,
          }),
        };
      });
    };
    const history = acquirePublicTradesHistory(coin, mergeRows);
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
          previous.missingTrade,
          evidence,
          fullLiveWindow,
        );
        const covered = fullLiveWindow || (hasSnapshot && !missingTrade);
        if (outcome === 'loading')
          return { ...previous, isLoading: !covered, missingTrade };
        let error: ITradesState['error'];
        if (!covered) error = hasSnapshot ? 'gap' : 'request';
        return {
          ...previous,
          isLoading: false,
          error,
          missingTrade,
          retryAttempt:
            outcome === 'failure' && !covered ? previous.retryAttempt + 1 : 0,
        };
      });
    };
    const fetchSnapshotOnce = async (reconnect: boolean, version: number) => {
      updateSnapshotStatus('loading');
      try {
        const applied = await history.fetch(reconnect);
        if (disposed || version !== requestVersion || !applied) return;
        updateSnapshotStatus('success');
      } catch {
        if (disposed || version !== requestVersion) return;
        updateSnapshotStatus('failure');
      }
    };

    function supersedeRequest() {
      const release = releasePending;
      releasePending = undefined;
      requestVersion += 1;
      snapshotPending = undefined;
      snapshotQueued = undefined;
      return release;
    }

    function fetchSnapshot(
      queueIfPending = false,
      reconnect = false,
    ): Promise<void> {
      if (snapshotPending) {
        if (queueIfPending && snapshotQueued !== 'reconnect')
          snapshotQueued = reconnect ? 'reconnect' : 'fetch';
        return snapshotPending;
      }
      const version = requestVersion;
      const run = async () => {
        let nextReconnect = reconnect;
        do {
          snapshotQueued = undefined;
          await fetchSnapshotOnce(nextReconnect, version);
          if (disposed || version !== requestVersion) break;
          nextReconnect = snapshotQueued === 'reconnect';
        } while (snapshotQueued);
      };
      const completion = Promise.withResolvers<void>();
      releasePending = completion.resolve;
      const pending = completion.promise.finally(() => {
        if (snapshotPending === pending) {
          snapshotPending = undefined;
          releasePending = undefined;
        }
      });
      snapshotPending = pending;
      void run().then(completion.resolve, completion.reject);
      return pending;
    }

    retryHttp.current = () => void fetchSnapshot();

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
        onTrades: (incoming, displayOnly) => {
          if (disposed) return;
          if (!displayOnly) {
            for (const trade of incoming) {
              if (liveTradeKeys.size === PERPS_RECENT_TRADES_LIMIT) break;
              liveTradeKeys.add(tradeKey(trade));
            }
          }
          mergeRows(incoming, history.evidence());
        },
        onStatus: (status) => {
          if (disposed) return;
          const isDisconnected = status !== 'connected';
          if (connected === !isDisconnected) return;
          setState((previous) =>
            previous.isDisconnected === isDisconnected
              ? previous
              : { ...previous, isDisconnected },
          );
          if (isDisconnected) {
            if (connected) {
              history.disconnect();
              const interrupted =
                !!snapshotPending &&
                liveTradeKeys.size < PERPS_RECENT_TRADES_LIMIT;
              supersedeRequest()?.();
              setState((previous) => ({
                ...previous,
                isLoading: false,
                retryAttempt: interrupted
                  ? Math.max(1, previous.retryAttempt)
                  : previous.retryAttempt,
              }));
            }
            liveTradeKeys.clear();
          } else {
            clearTimeout(fallbackTimer);
            const reconnect = connected === false;
            // Join the ticker's reconnect even if an older offline read is stalled.
            const handoff =
              reconnect && history.hasRecovery()
                ? supersedeRequest()
                : undefined;
            if (handoff) manualRetry = false;
            const recovery = fetchSnapshot(true, reconnect);
            handoff?.(recovery);
            void backgroundApiProxy.serviceHyperliquidSubscription
              .getRetainedPublicTrades({ coin })
              .then((trades) => {
                if (disposed || !trades.length) return;
                mergeRows(trades, history.evidence(), undefined, true);
              })
              .catch(() => {
                // The HTTP snapshot and live feed can still populate the tape.
              });
          }
          connected = !isDisconnected;
        },
      });
    let unwatch = subscribe();
    const unregisterRefresh = registerPerpPublicTradesRefresh(async () => {
      clearTimeout(fallbackTimer);
      setState((previous) => ({ ...previous, retryAttempt: 0 }));
      manualRetry = true;
      const replaceRecovery = history.discardCompletedRecovery();
      if (!connected) {
        unwatch();
        unwatch = subscribe();
      }
      await fetchSnapshot(true, replaceRecovery);
      manualRetry = false;
    });
    return () => {
      disposed = true;
      retryHttp.current = undefined;
      supersedeRequest()?.();
      unregisterRefresh();
      history.release();
      clearTimeout(fallbackTimer);
      unwatch();
    };
  }, [coin, active]);

  useEffect(() => {
    if (!active || state.isLoading || !state.retryAttempt) return;
    const timer = setTimeout(
      () => retryHttp.current?.(),
      Math.min(1000 * 2 ** (state.retryAttempt - 1), 30_000),
    );
    return () => clearTimeout(timer);
  }, [active, coin, state.isLoading, state.retryAttempt]);

  const smallBatch =
    state.trades.length > 0 && state.trades.length < INITIAL_BATCH_ROWS;
  const hasStatus = !!state.error || state.isDisconnected;
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
    coin: state.coin,
    isDisconnected: state.isDisconnected,
    isError: !!state.error,
    trades: holdFirstBatch ? initialState.trades : state.trades,
    isLoading: state.isLoading || holdFirstBatch,
  };
}
