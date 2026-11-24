import { useCallback, useContext, useEffect, useRef } from 'react';

import { TradingViewNativeMultiChartSyncContext } from './TradingViewNativeMultiChartSyncContext';

import type { ITradingViewNativeIntervalSyncMember } from './intervalSync';

/**
 * Keeps the chart on the interval its split view shares. Returns what to call
 * when the user picks an interval in this chart, so the others follow.
 */
export function useMultiChartIntervalSync({
  activeInterval,
  onSyncedIntervalChange,
}: {
  activeInterval: string;
  /** Applies an interval another panel picked; may ignore one it cannot show. */
  onSyncedIntervalChange: (interval: string) => void;
}) {
  const scope = useContext(TradingViewNativeMultiChartSyncContext);
  const sync = scope?.interval ?? null;
  const isMain = scope?.isMain ?? false;
  const reportInterval = scope?.reportInterval;
  useEffect(() => {
    reportInterval?.(activeInterval);
  }, [activeInterval, reportInterval]);
  useEffect(() => () => reportInterval?.(undefined), [reportInterval]);
  const reportIntervalPick = scope?.reportIntervalPick;
  const latest = useRef({
    activeInterval,
    onSyncedIntervalChange,
    reportIntervalPick,
  });
  latest.current = {
    activeInterval,
    onSyncedIntervalChange,
    reportIntervalPick,
  };
  const memberRef = useRef<ITradingViewNativeIntervalSyncMember | null>(null);
  useEffect(() => {
    if (!sync) return undefined;
    const adopt = () => {
      const shared = sync.get();
      if (shared !== undefined && shared !== latest.current.activeInterval) {
        latest.current.onSyncedIntervalChange(shared);
      }
    };
    const member = sync.join(adopt);
    memberRef.current = member;
    // Syncing starts from the interval it was turned on with, or else from
    // the first panel's. Once the panels share one, the first panel takes it
    // like the others, e.g. when its chart is mounted anew.
    if (isMain && sync.get() === undefined) {
      member.set(latest.current.activeInterval);
    } else {
      adopt();
    }
    return () => {
      memberRef.current = null;
      member.leave();
    };
  }, [isMain, sync]);
  return useCallback((interval: string) => {
    latest.current.reportIntervalPick?.(interval);
    memberRef.current?.set(interval);
  }, []);
}
