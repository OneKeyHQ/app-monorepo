import { useCallback, useContext, useEffect, useRef } from 'react';
import type { RefObject } from 'react';

import { TradingViewNativeMultiChartSyncContext } from '../multiChart/TradingViewNativeMultiChartSyncContext';

import type { ITradingViewNativeViewportSyncMember } from '../multiChart/viewportSync';
import type { ITradingViewNativeSyncedViewport } from '../utils/syncedViewport';

/**
 * Joins the chart to the viewport shared by its split view: the chart the user
 * moved last leads and the others line up with it. Outside a split view, or
 * with time and date range syncing off, the chart keeps to itself.
 */
export function useChartViewportSync(redrawRef: RefObject<() => void>) {
  const scope = useContext(TradingViewNativeMultiChartSyncContext);
  const sync = scope?.viewport ?? null;
  const channel = sync?.channel ?? null;
  const isMain = scope?.isMain ?? false;
  const memberRef = useRef<ITradingViewNativeViewportSyncMember | null>(null);
  useEffect(() => {
    if (!channel) return undefined;
    const member = channel.join({ onChange: () => redrawRef.current() });
    memberRef.current = member;
    // Until the user moves a chart, the others line up with the first panel.
    if (isMain && !channel.hasLeader()) member.lead();
    // Reports the chart's viewport, or lines it up with the leading chart's.
    redrawRef.current();
    return () => {
      memberRef.current = null;
      member.leave();
    };
  }, [channel, isMain, redrawRef]);
  const fitRange = sync?.fitRange ?? false;
  const fitRangeRef = useRef(fitRange);
  fitRangeRef.current = fitRange;
  useEffect(() => {
    // Lines up again when the span of time starts or stops being matched.
    if (channel) redrawRef.current();
  }, [channel, fitRange, redrawRef]);
  /** What to line up with before a draw; null for the leading chart. */
  const getFollowedViewport = useCallback(() => {
    const viewport = memberRef.current?.getViewport();
    return viewport ? { viewport, fitRange: fitRangeRef.current } : null;
  }, []);
  /** Call as the user moves this chart's viewport. */
  const leadViewport = useCallback(() => memberRef.current?.lead(), []);
  /** Call after every draw with what the chart shows. */
  const publishViewport = useCallback(
    (viewport: ITradingViewNativeSyncedViewport | null) => {
      if (viewport) memberRef.current?.publish(viewport);
    },
    [],
  );
  return { getFollowedViewport, leadViewport, publishViewport };
}
