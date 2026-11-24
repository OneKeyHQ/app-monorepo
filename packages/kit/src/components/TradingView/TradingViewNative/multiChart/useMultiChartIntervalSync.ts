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
  const isLead = scope?.isIntervalLead ?? false;
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
    // Syncing starts from the lead panel's interval. Once the panels share
    // one, a panel that joins takes it, also when it leads by then: the lead
    // moving to another panel, e.g. with the selection, changes no interval.
    if (isLead && sync.get() === undefined) {
      member.set(latest.current.activeInterval);
    } else {
      adopt();
    }
    return () => {
      memberRef.current = null;
      member.leave();
    };
  }, [isLead, sync]);
  return useCallback(
    (interval: string) => memberRef.current?.set(interval),
    [],
  );
}
