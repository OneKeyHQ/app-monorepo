import { useCallback, useContext, useEffect, useRef } from 'react';

import { TradingViewNativeMultiChartSyncContext } from './TradingViewNativeMultiChartSyncContext';

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
  const latest = useRef({ activeInterval, onSyncedIntervalChange });
  latest.current = { activeInterval, onSyncedIntervalChange };
  useEffect(() => {
    if (!sync) return undefined;
    const adopt = () => {
      const shared = sync.get();
      if (shared !== undefined && shared !== latest.current.activeInterval) {
        latest.current.onSyncedIntervalChange(shared);
      }
    };
    // Syncing starts from the first panel's interval.
    if (isMain) sync.set(latest.current.activeInterval);
    else adopt();
    return sync.subscribe(adopt);
  }, [isMain, sync]);
  return useCallback((interval: string) => sync?.set(interval), [sync]);
}
