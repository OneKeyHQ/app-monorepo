import { useCallback, useContext, useEffect, useRef } from 'react';
import type { RefObject } from 'react';

import { TradingViewNativeMultiChartSyncContext } from '../multiChart/TradingViewNativeMultiChartSyncContext';

import type { ITradingViewNativeCrosshairSyncMember } from '../multiChart/crosshairSync';
import type { ITradingViewNativeCrosshairPosition } from '../utils/chartRuntime';

/**
 * Joins the chart to the crosshair shared by its split view. Outside one, or
 * with syncing turned off, there is nothing to follow and nothing is shared.
 */
export function useChartCrosshairSync(redrawRef: RefObject<() => void>) {
  const scope = useContext(TradingViewNativeMultiChartSyncContext);
  const channel = scope?.crosshair ?? null;
  const instrumentKey = scope?.instrumentKey ?? '';
  const memberRef = useRef<ITradingViewNativeCrosshairSyncMember | null>(null);
  useEffect(() => {
    if (!channel) return undefined;
    // Always the chart's current redraw, also when leaving.
    const redraw = () => redrawRef.current();
    const member = channel.join({ instrumentKey, onChange: redraw });
    memberRef.current = member;
    // Picks up a crosshair shared before this chart joined, and shares its own.
    redraw();
    return () => {
      memberRef.current = null;
      member.leave();
      redraw();
    };
  }, [channel, instrumentKey, redrawRef]);
  /** The crosshair of another chart, to draw while this one has none. */
  const getSyncedCrosshair = useCallback(
    () => memberRef.current?.getPosition() ?? null,
    [],
  );
  /** Call after every draw with the chart's own crosshair, or null without one. */
  const publishCrosshair = useCallback(
    (position: ITradingViewNativeCrosshairPosition | null) => {
      memberRef.current?.publish(position);
    },
    [],
  );
  return { getSyncedCrosshair, publishCrosshair };
}
