import { useCallback, useEffect, useMemo, useRef } from 'react';

import { getTradingViewNativeKLineInterval } from '@onekeyhq/kit/src/components/TradingView/TradingViewNative/data/tradingViewNativeIntervals';
import {
  readStoredTradingViewNativeActiveInterval,
  saveTradingViewNativeActiveInterval,
} from '@onekeyhq/kit/src/components/TradingView/TradingViewNative/data/tradingViewNativeIntervalStorage';
import type { ITradingViewNativeIntervalStorageNamespace } from '@onekeyhq/kit/src/components/TradingView/TradingViewNative/data/tradingViewNativeIntervalStorage';

import type { ITradingViewIntervalConfigData } from '../../../types';

function getSharedInterval(interval: string) {
  const hourMatch = interval.match(/^(\d+)H$/);
  return getTradingViewNativeKLineInterval(
    hourMatch ? String(Number(hourMatch[1]) * 60) : interval,
  )?.value;
}

export function useTradingViewIntervalSync({
  namespace,
  intervalConfig,
  isReady,
  onIntervalChange,
}: {
  namespace?: ITradingViewNativeIntervalStorageNamespace;
  intervalConfig: ITradingViewIntervalConfigData | null;
  isReady: boolean;
  onIntervalChange: (interval: string) => void;
}) {
  const syncState = useMemo(() => {
    const initialInterval = namespace
      ? readStoredTradingViewNativeActiveInterval(namespace)
      : undefined;
    return {
      initialInterval,
      lastSavedInterval: initialInterval,
      pendingInterval: initialInterval,
      requested: false,
    };
  }, [namespace]);
  const onIntervalChangeRef = useRef(onIntervalChange);
  onIntervalChangeRef.current = onIntervalChange;

  const reset = useCallback(() => {
    syncState.pendingInterval = namespace
      ? readStoredTradingViewNativeActiveInterval(namespace)
      : undefined;
    syncState.lastSavedInterval = syncState.pendingInterval;
    syncState.requested = false;
  }, [namespace, syncState]);

  const saveInterval = useCallback(
    (interval: string) => {
      const sharedInterval = getSharedInterval(interval);
      if (namespace && sharedInterval) {
        syncState.pendingInterval = sharedInterval;
        syncState.lastSavedInterval = sharedInterval;
        syncState.requested = isReady;
        void saveTradingViewNativeActiveInterval({
          interval: sharedInterval,
          namespace,
        });
      }
    },
    [isReady, namespace, syncState],
  );

  useEffect(() => {
    if (!namespace || !intervalConfig || !isReady) {
      return;
    }
    const sharedInterval = getSharedInterval(intervalConfig.activeInterval);
    if (syncState.pendingInterval) {
      const target = intervalConfig.intervals.find(
        (option) =>
          !option.disabled &&
          getSharedInterval(option.value) === syncState.pendingInterval,
      );
      // Wait for layout restoration and the requested interval's acknowledgement.
      // An older chart may not support every interval offered by Original.
      if (!target) {
        return;
      }
      if (sharedInterval !== syncState.pendingInterval) {
        if (!syncState.requested) {
          syncState.requested = true;
          onIntervalChangeRef.current(target.value);
        }
        return;
      }
      if (intervalConfig.persist === false) {
        return;
      }
      syncState.pendingInterval = undefined;
    }
    if (
      sharedInterval &&
      sharedInterval !== syncState.lastSavedInterval &&
      intervalConfig.persist !== false
    ) {
      syncState.lastSavedInterval = sharedInterval;
      void saveTradingViewNativeActiveInterval({
        interval: sharedInterval,
        namespace,
      });
    }
  }, [intervalConfig, isReady, namespace, syncState]);

  const pendingOption = syncState.pendingInterval
    ? intervalConfig?.intervals.find(
        (option) =>
          !option.disabled &&
          getSharedInterval(option.value) === syncState.pendingInterval,
      )
    : undefined;
  const displayedIntervalConfig =
    intervalConfig && pendingOption
      ? { ...intervalConfig, activeInterval: pendingOption.value }
      : intervalConfig;
  const isRestoringInterval = Boolean(
    syncState.pendingInterval &&
    (!intervalConfig ||
      (pendingOption &&
        (!isReady ||
          intervalConfig.persist === false ||
          getSharedInterval(intervalConfig.activeInterval) !==
            syncState.pendingInterval))),
  );

  return {
    initialInterval: syncState.initialInterval,
    displayedIntervalConfig,
    isRestoringInterval,
    reset,
    saveInterval,
  };
}
