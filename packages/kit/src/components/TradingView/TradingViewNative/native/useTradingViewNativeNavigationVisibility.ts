import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { AccessibilityInfo } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';

import { TRADING_VIEW_NATIVE_CROSSHAIR_LONG_PRESS_DURATION } from '../chartConstants';

export const TRADING_VIEW_NATIVE_NAVIGATION_IDLE_HIDE_DELAY = 5000;
// A touch that travels farther than this is a drag, not a tap.
const TRADING_VIEW_NATIVE_NAVIGATION_TAP_MAX_DISTANCE = 10;

function useIsScreenReaderEnabled() {
  const [isScreenReaderEnabled, setIsScreenReaderEnabled] = useState(false);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isScreenReaderEnabled().then((value) => {
      if (mounted) {
        setIsScreenReaderEnabled(value);
      }
    });
    const subscription = AccessibilityInfo.addEventListener(
      'screenReaderChanged',
      (value) => setIsScreenReaderEnabled(value),
    );
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);
  return isScreenReaderEnabled;
}

/**
 * Touch charts keep the navigation buttons hidden until the chart is tapped,
 * and hide them again after a period without taps or button presses.
 * Dragging the chart hides them at once; the touch that dragged does not
 * bring them back when it lifts. With a screen reader on, the buttons stay
 * visible because a chart tap is not reachable through accessibility focus.
 */
export function useTradingViewNativeNavigationVisibility(enabled: boolean) {
  const [isVisible, setIsVisible] = useState(false);
  const isScreenReaderEnabled = useIsScreenReaderEnabled();
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
        // A hold long enough to start the crosshair is not a tap.
        .maxDuration(TRADING_VIEW_NATIVE_CROSSHAIR_LONG_PRESS_DURATION)
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
    isVisible: enabled && (isVisible || isScreenReaderEnabled),
    tapGesture,
  };
}
