import { useCallback, useEffect, useRef, useState } from 'react';

import {
  perpsNetworkStatusAtom,
  perpsWebSocketConnectedAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { jotaiDefaultStore } from '@onekeyhq/kit-bg/src/states/jotai/utils/jotaiDefaultStore';

import {
  PERPS_MARKET_DATA_STALE_MS,
  getPerpsMarketDataFreshness,
} from '../utils/perpsMarketDataFreshness';

function getCurrentPerpsMarketDataFreshness(staleMs: number) {
  const networkStatus = jotaiDefaultStore.get(perpsNetworkStatusAtom.atom());
  const isWebSocketConnected = jotaiDefaultStore.get(
    perpsWebSocketConnectedAtom.atom(),
  );

  return getPerpsMarketDataFreshness({
    isWebSocketConnected,
    networkConnected: networkStatus?.connected,
    lastMessageAt: networkStatus?.lastMessageAt ?? null,
    nowMs: Date.now(),
    staleMs,
  });
}

export function usePerpsMarketDataFreshness({
  staleMs = PERPS_MARKET_DATA_STALE_MS,
}: {
  staleMs?: number;
} = {}) {
  const statusRef = useRef<{
    connected: boolean | undefined;
    lastMessageAt: number | null;
  }>({
    connected: undefined,
    lastMessageAt: null,
  });
  const isWebSocketConnectedRef = useRef(false);
  const staleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [freshness, setFreshness] = useState(() =>
    getCurrentPerpsMarketDataFreshness(staleMs),
  );

  const clearStaleTimer = useCallback(() => {
    if (staleTimerRef.current) {
      clearTimeout(staleTimerRef.current);
      staleTimerRef.current = null;
    }
  }, []);

  const publishFreshness = useCallback(() => {
    const status = statusRef.current;
    const next = getPerpsMarketDataFreshness({
      isWebSocketConnected: isWebSocketConnectedRef.current,
      networkConnected: status.connected,
      lastMessageAt: status.lastMessageAt,
      nowMs: Date.now(),
      staleMs,
    });

    setFreshness((prev) => {
      if (
        prev.isReady === next.isReady &&
        prev.isStale === next.isStale &&
        prev.reason === next.reason
      ) {
        return prev;
      }
      return next;
    });
  }, [staleMs]);

  const scheduleStaleTimer = useCallback(() => {
    clearStaleTimer();

    const status = statusRef.current;
    if (
      !isWebSocketConnectedRef.current ||
      status.connected === false ||
      !status.lastMessageAt
    ) {
      return;
    }

    const delayMs = Math.max(
      0,
      status.lastMessageAt + staleMs + 1000 - Date.now(),
    );
    staleTimerRef.current = setTimeout(() => {
      staleTimerRef.current = null;
      publishFreshness();
    }, delayMs);
  }, [clearStaleTimer, publishFreshness, staleMs]);

  useEffect(() => {
    const refreshFromAtoms = () => {
      const networkStatus = jotaiDefaultStore.get(
        perpsNetworkStatusAtom.atom(),
      );
      const isWebSocketConnected = jotaiDefaultStore.get(
        perpsWebSocketConnectedAtom.atom(),
      );
      statusRef.current = {
        connected: networkStatus?.connected,
        lastMessageAt: networkStatus?.lastMessageAt ?? null,
      };
      isWebSocketConnectedRef.current = isWebSocketConnected;
      publishFreshness();
      scheduleStaleTimer();
    };

    void refreshFromAtoms();
    const unsubscribeNetworkStatus =
      perpsNetworkStatusAtom.sub(refreshFromAtoms);
    const unsubscribeWebSocketConnected =
      perpsWebSocketConnectedAtom.sub(refreshFromAtoms);

    return () => {
      clearStaleTimer();
      unsubscribeNetworkStatus();
      unsubscribeWebSocketConnected();
    };
  }, [clearStaleTimer, publishFreshness, scheduleStaleTimer]);

  return freshness;
}
