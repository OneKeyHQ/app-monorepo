import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Gesture } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';

export const TRADING_VIEW_NATIVE_NAVIGATION_IDLE_HIDE_DELAY = 5000;
// A touch that travels farther than this is a drag, not a tap.
const TRADING_VIEW_NATIVE_NAVIGATION_TAP_MAX_DISTANCE = 10;

/**
 * Touch charts keep the navigation buttons hidden until the chart is tapped,
 * and hide them again after a period without taps or button presses.
 * Dragging the chart hides them at once; the touch that dragged does not
 * bring them back when it lifts.
 */
export function useTradingViewNativeNavigationVisibility(enabled: boolean) {
  const [isVisible, setIsVisible] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTouchDraggedRef = useRef(false);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const hide = useCallback(() => {
    clearHideTimer();
    setIsVisible(false);
  }, [clearHideTimer]);

  const show = useCallback(() => {
    clearHideTimer();
    setIsVisible(true);
    hideTimerRef.current = setTimeout(() => {
      hideTimerRef.current = null;
      setIsVisible(false);
    }, TRADING_VIEW_NATIVE_NAVIGATION_IDLE_HIDE_DELAY);
  }, [clearHideTimer]);

  const handleTouchStart = useCallback(() => {
    isTouchDraggedRef.current = false;
  }, []);

  const handleTap = useCallback(() => {
    if (!isTouchDraggedRef.current) show();
  }, [show]);

  const handleChartDragStart = useCallback(() => {
    isTouchDraggedRef.current = true;
    hide();
  }, [hide]);

  useEffect(() => {
    if (!enabled) hide();
  }, [enabled, hide]);

  useEffect(() => clearHideTimer, [clearHideTimer]);

  // Runs alongside the chart gestures so a tap still reveals the buttons when
  // another recognizer (crosshair, indicator legend) also handles it.
  const tapGesture = useMemo(
    () =>
      Gesture.Tap()
        .enabled(enabled)
        .maxDistance(TRADING_VIEW_NATIVE_NAVIGATION_TAP_MAX_DISTANCE)
        .onBegin(() => {
          'worklet';

          scheduleOnRN(handleTouchStart);
        })
        .onEnd((_event, success) => {
          'worklet';

          if (success) scheduleOnRN(handleTap);
        }),
    [enabled, handleTap, handleTouchStart],
  );

  return {
    handleChartDragStart,
    // A button press counts as activity and restarts the hide delay.
    handleControlPress: show,
    isVisible: enabled && isVisible,
    tapGesture,
  };
}
