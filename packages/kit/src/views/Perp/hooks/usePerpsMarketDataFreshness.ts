import { useEffect, useMemo, useState } from 'react';

import { useInterval } from '@onekeyhq/kit/src/hooks/useInterval';
import {
  usePerpsNetworkStatusAtom,
  usePerpsWebSocketConnectedAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import {
  PERPS_MARKET_DATA_STALE_MS,
  getPerpsMarketDataFreshness,
} from '../utils/perpsMarketDataFreshness';

export function usePerpsMarketDataFreshness({
  staleMs = PERPS_MARKET_DATA_STALE_MS,
  tickMs = 1000,
}: {
  staleMs?: number;
  tickMs?: number;
} = {}) {
  const [networkStatus] = usePerpsNetworkStatusAtom();
  const [isWebSocketConnected] = usePerpsWebSocketConnectedAtom();
  const [nowMs, setNowMs] = useState(() => Date.now());
  const lastMessageAt = networkStatus?.lastMessageAt ?? null;
  const networkConnected = networkStatus?.connected;

  useEffect(() => {
    setNowMs(Date.now());
  }, [isWebSocketConnected, lastMessageAt, networkConnected]);

  useInterval(
    () => {
      setNowMs(Date.now());
    },
    isWebSocketConnected && networkConnected !== false && lastMessageAt
      ? tickMs
      : null,
  );

  return useMemo(
    () =>
      getPerpsMarketDataFreshness({
        isWebSocketConnected,
        networkConnected,
        lastMessageAt,
        nowMs,
        staleMs,
      }),
    [isWebSocketConnected, lastMessageAt, networkConnected, nowMs, staleMs],
  );
}
