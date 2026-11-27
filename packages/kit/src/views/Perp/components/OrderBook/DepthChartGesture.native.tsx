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

  // Start selection on touch-down, then give vertical drags to the page scroller.
  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-6, 6])
        .failOffsetY([-6, 6])
        .maxPointers(1)
        .runOnJS(true)
        .onBegin((event) => callbacks.current.onTouchMove(event.x))
        .onStart((event) => callbacks.current.onTouchMove(event.x))
        .onUpdate((event) => callbacks.current.onTouchMove(event.x))
        .onFinalize(() => callbacks.current.onTouchEnd()),
    [],
  );

  return <GestureDetector gesture={gesture}>{children}</GestureDetector>;
}
