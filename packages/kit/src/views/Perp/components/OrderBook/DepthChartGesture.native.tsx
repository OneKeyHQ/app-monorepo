import { useLayoutEffect, useMemo, useRef } from 'react';

import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import type { IDepthChartGestureProps } from './DepthChartGesture';

export function DepthChartGesture({
  children,
  onTouchMove,
  onTouchEnd,
}: IDepthChartGestureProps) {
  const callbacks = useRef({ onTouchMove, onTouchEnd });
  useLayoutEffect(() => {
    callbacks.current = { onTouchMove, onTouchEnd };
  }, [onTouchEnd, onTouchMove]);

  // Claim the native pan before navigation can recognize a swipe-back. Keep
  // the recognizer stable while live book updates render the chart again.
  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(0)
        .maxPointers(1)
        .runOnJS(true)
        .onStart((event) => callbacks.current.onTouchMove(event.x))
        .onUpdate((event) => callbacks.current.onTouchMove(event.x))
        .onFinalize(() => callbacks.current.onTouchEnd()),
    [],
  );

  return <GestureDetector gesture={gesture}>{children}</GestureDetector>;
}
