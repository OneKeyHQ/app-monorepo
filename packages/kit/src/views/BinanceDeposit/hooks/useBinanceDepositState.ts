import { useCallback, useEffect, useRef, useState } from 'react';

import {
  getCurrentVisibilityState,
  useVisibilityChange,
} from '@onekeyhq/components/src/hooks/useVisibilityChange';
import { BINANCE_DEPOSIT_STATE_POLL_INTERVAL_MS } from '@onekeyhq/shared/src/consts/binanceDepositConsts';
import type { IBinanceDepositState } from '@onekeyhq/shared/types/exchange';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useRouteIsFocused } from '../../../hooks/useRouteIsFocused';
import { recoverBinanceDepositReturnOnForeground } from '../../../routes/config/deeplink/binanceDepositReturn';
import { isSameBinanceDepositEventList } from '../utils';

const CLOCK_TICK_INTERVAL_MS = 1000;

// The page only mirrors what the background service holds: it polls the
// local snapshot and never drives the bind retries, which keep running in the
// background while this page is covered, unfocused or unmounted.
export function useBinanceDepositState() {
  const [state, setState] = useState<IBinanceDepositState | undefined>();
  const [isStateUnavailable, setIsStateUnavailable] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const isFocused = useRouteIsFocused();

  const isMountedRef = useRef(true);
  const requestSeqRef = useRef(0);
  const appliedSeqRef = useRef(0);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async (): Promise<
    IBinanceDepositState | undefined
  > => {
    requestSeqRef.current += 1;
    const seq = requestSeqRef.current;
    try {
      const next = await backgroundApiProxy.serviceBinanceDeposit.getState();
      // A slower, older read must not overwrite a newer snapshot.
      if (isMountedRef.current && seq > appliedSeqRef.current) {
        appliedSeqRef.current = seq;
        setState((previous) =>
          previous &&
          isSameBinanceDepositEventList(previous.events, next.events)
            ? { ...next, events: previous.events }
            : next,
        );
        setIsStateUnavailable(false);
        setNow(Date.now());
      }
      return next;
    } catch {
      if (isMountedRef.current && seq > appliedSeqRef.current) {
        setIsStateUnavailable(true);
      }
      return undefined;
    }
  }, []);

  useEffect(() => {
    if (!isFocused) {
      return;
    }
    void refresh();
    const pollTimer = setInterval(() => {
      if (getCurrentVisibilityState()) {
        void refresh();
      }
    }, BINANCE_DEPOSIT_STATE_POLL_INTERVAL_MS);
    const clockTimer = setInterval(() => {
      setNow(Date.now());
    }, CLOCK_TICK_INTERVAL_MS);
    return () => {
      clearInterval(pollTimer);
      clearInterval(clockTimer);
    };
  }, [isFocused, refresh]);

  // Runs when the page opens and every time the app returns to the
  // foreground: deliver reports that are still pending, and pick up a Binance
  // return whose OS `url` event was lost (seen on Android warm starts).
  const runForegroundTasks = useCallback(async () => {
    void backgroundApiProxy.serviceBinanceDeposit.retryPendingReports().then(
      () => refresh(),
      () => undefined,
    );
    const latest = await refresh();
    const active = latest?.active;
    if (active?.awaitingReturn && !active.returnReceivedAt) {
      try {
        await recoverBinanceDepositReturnOnForeground();
      } catch {
        // Best effort. The caught value may describe the return URL, so it is
        // neither inspected nor logged.
      }
      await refresh();
    }
  }, [refresh]);

  useEffect(() => {
    void runForegroundTasks();
  }, [runForegroundTasks]);

  const handleVisibilityChange = useCallback(
    (visible: boolean) => {
      if (visible) {
        void runForegroundTasks();
      }
    },
    [runForegroundTasks],
  );
  useVisibilityChange(handleVisibilityChange);

  return { state, isStateUnavailable, now, refresh };
}
