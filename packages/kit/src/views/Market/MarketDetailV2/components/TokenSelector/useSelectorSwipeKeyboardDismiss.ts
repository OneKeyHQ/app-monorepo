import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import type { RefObject } from 'react';

import { Keyboard } from 'react-native';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { dismissMobileTokenSelectorKeyboard } from './dismissMobileTokenSelectorKeyboard';

import type { GestureResponderEvent, LayoutChangeEvent } from 'react-native';

const SWIPE_THRESHOLD = 12;
type ITouchEvent = Pick<GestureResponderEvent, 'nativeEvent'>;

type ISelectorListDimensions = { height?: number; contentHeight?: number };
type ISelectorListMeasurements = Map<symbol, ISelectorListDimensions>;

export const SelectorListMeasurementsContext =
  createContext<RefObject<ISelectorListMeasurements> | null>(null);

// Measure the actual viewport, including keyboard/layout changes and list headers.
export function useSelectorListMeasurements(hasList = true) {
  const measurements = useContext(SelectorListMeasurementsContext);
  const listId = useRef(Symbol('selector-list'));
  const dimensions = useRef<ISelectorListDimensions>({});
  const enabled =
    platformEnv.isNativeAndroid && Boolean(measurements) && hasList;
  const update = useCallback(() => {
    if (enabled) {
      measurements?.current.set(listId.current, { ...dimensions.current });
    }
  }, [enabled, measurements]);
  useEffect(() => {
    const id = listId.current;
    const lists = measurements?.current;
    update();
    return () => {
      lists?.delete(id);
    };
  }, [measurements, update]);
  const onLayout = useCallback(
    (event: Pick<LayoutChangeEvent, 'nativeEvent'>) => {
      dimensions.current.height = event.nativeEvent.layout.height;
      update();
    },
    [update],
  );
  const onContentSizeChange = useCallback(
    (_width: number, height: number) => {
      dimensions.current.contentHeight = height;
      update();
    },
    [update],
  );
  return enabled ? { onLayout, onContentSizeChange } : {};
}

export function useSelectorSwipeKeyboardDismiss() {
  const listMeasurements = useRef<ISelectorListMeasurements>(new Map());
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
    // Scrollable (or not yet measured) lists keep their first drag; their native
    // keyboardDismissMode handles dismissal without consuming the scroll.
    const hasScrollableList = [...listMeasurements.current.values()].some(
      ({ height, contentHeight }) =>
        height === undefined ||
        contentHeight === undefined ||
        contentHeight > height,
    );
    if (!start || !Keyboard.isVisible() || hasScrollableList) {
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

  const swipeKeyboardDismissProps = useMemo(
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
  return { swipeKeyboardDismissProps, listMeasurements };
}
