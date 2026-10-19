import { useCallback, useMemo, useRef } from 'react';

import { Keyboard } from 'react-native';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { dismissMobileTokenSelectorKeyboard } from './dismissMobileTokenSelectorKeyboard';

import type { GestureResponderEvent } from 'react-native';

const SWIPE_THRESHOLD = 12;
type ITouchEvent = Pick<GestureResponderEvent, 'nativeEvent'>;

export function useSelectorSwipeKeyboardDismiss() {
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const isAndroid = platformEnv.isNativeAndroid;
  const resetTouch = useCallback(() => {
    touchStart.current = null;
  }, []);
  const handleStartCapture = useCallback((event: ITouchEvent) => {
    const { pageX, pageY, touches } = event.nativeEvent;
    touchStart.current =
      Keyboard.isVisible() && touches.length === 1
        ? { x: pageX, y: pageY }
        : null;
    return false;
  }, []);
  const handleMoveCapture = useCallback((event: ITouchEvent) => {
    const start = touchStart.current;
    if (!start || !Keyboard.isVisible()) {
      return false;
    }
    const { pageX, pageY, touches } = event.nativeEvent;
    if (touches.length !== 1) {
      touchStart.current = null;
      return false;
    }
    const dx = Math.abs(pageX - start.x);
    const dy = Math.abs(pageY - start.y);
    return dy > SWIPE_THRESHOLD && dy > dx;
  }, []);
  const handleGrant = useCallback(() => {
    resetTouch();
    dismissMobileTokenSelectorKeyboard();
  }, [resetTouch]);
  const allowTermination = useCallback(() => true, []);

  return useMemo(
    () =>
      isAndroid
        ? {
            // Short Android lists do not emit scroll-begin-drag. Capture only
            // vertical swipes with an open keyboard, cancelling row presses.
            onStartShouldSetResponderCapture: handleStartCapture,
            onMoveShouldSetResponderCapture: handleMoveCapture,
            onResponderGrant: handleGrant,
            onResponderTerminationRequest: allowTermination,
            onResponderRelease: resetTouch,
            onResponderTerminate: resetTouch,
            onTouchEnd: resetTouch,
            onTouchCancel: resetTouch,
          }
        : {},
    [
      isAndroid,
      handleStartCapture,
      handleMoveCapture,
      handleGrant,
      allowTermination,
      resetTouch,
    ],
  );
}
