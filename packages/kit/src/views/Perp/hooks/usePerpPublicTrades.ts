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
  const retry = useCallback(() => setAttempt((previous) => previous + 1), []);

  useEffect(() => {
    if (!active) return;
    let disposed = false;
    let connected = false;
    let snapshotId = 0;
    const liveTradeKeys = new Set<string>();
    setState((previous) => ({ ...previous, isLoading: true, isError: false }));
    const fetchSnapshot = async () => {
      snapshotId += 1;
      const id = snapshotId;
      setState((previous) => ({
        ...previous,
        isLoading: liveTradeKeys.size < PERPS_RECENT_TRADES_LIMIT,
        isError: false,
      }));
      try {
        const snapshot =
          await backgroundApiProxy.serviceHyperliquid.getPerpRecentTrades({
            coin,
          });
        if (disposed || id !== snapshotId) return;
        const incoming = snapshot.filter((trade) => trade.coin === coin);
        setState((previous) => ({
          ...previous,
          trades: latestTrades(incoming, previous.trades),
          isLoading: false,
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

  return { ...state, retry };
}
