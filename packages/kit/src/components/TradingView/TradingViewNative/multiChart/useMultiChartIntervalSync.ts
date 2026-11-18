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
  const latest = useRef({ activeInterval, onSyncedIntervalChange });
  latest.current = { activeInterval, onSyncedIntervalChange };
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
    // Syncing starts from the first panel's interval.
    if (isMain) member.set(latest.current.activeInterval);
    else adopt();
    return () => {
      memberRef.current = null;
      member.leave();
    };
  }, [isMain, sync]);
  return useCallback(
    (interval: string) => memberRef.current?.set(interval),
    [],
  );
}
