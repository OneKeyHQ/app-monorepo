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

function latestTrades(incoming: IRecentTrade[], previous: IRecentTrade[]) {
  const unique = uniqBy(
    [...incoming, ...previous],
    (trade) => `${trade.time}:${trade.tid}`,
  );
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
    let needsBackfill = false;
    let snapshotId = 0;
    const fetchSnapshot = async () => {
      snapshotId += 1;
      const id = snapshotId;
      setState((previous) => ({
        ...previous,
        isLoading: true,
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
        setState((previous) => ({
          ...previous,
          isLoading: false,
          isError: true,
        }));
      }
    };

    const unwatch = watchHyperliquidPublicTrades({
      coin,
      limit: PERPS_RECENT_TRADES_LIMIT,
      onTrades: (incoming) => {
        setState((previous) => ({
          ...previous,
          trades: latestTrades(incoming, previous.trades),
        }));
      },
      onStatus: (status) => {
        const isDisconnected = status !== 'connected';
        setState((previous) =>
          previous.isDisconnected === isDisconnected
            ? previous
            : { ...previous, isDisconnected },
        );
        if (!isDisconnected && needsBackfill) {
          void fetchSnapshot();
        }
        needsBackfill = isDisconnected;
      },
    });
    void fetchSnapshot();
    return () => {
      disposed = true;
      unwatch();
    };
  }, [coin, active, attempt]);

  return { ...state, retry };
}
