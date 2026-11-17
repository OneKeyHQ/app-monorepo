import { useMemo } from 'react';

import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, withSpring } from 'react-native-reanimated';

import { Stack } from '../../primitives';

import type { IHeaderDragZoneProps } from './HeaderDragZone';

// A header drag lets go of the sheet once it has moved this far or this
// fast; shorter and slower pulls spring back. Tamagui's own frame drag reads
// the snap points for that decision, which a header-only drag has no view of.
const HEADER_DRAG_DISMISS_DISTANCE = 120;
const HEADER_DRAG_DISMISS_VELOCITY = 800;
// Pulling the header up moves the sheet a fifth of the way: a hint that it
// cannot go there, not a scroll.
const HEADER_DRAG_UPWARD_RESISTANCE = 0.2;
const HEADER_DRAG_SPRING = {
  stiffness: 220,
  damping: 30,
  mass: 1,
  overshootClamping: true,
} as const;

/**
 * The grabber + title row of a header-drag sheet (OK-61140): carries the pan
 * that moves the sheet body through `dragY` and dismisses past the thresholds
 * above. Lives in its own native file so the gesture-handler import stays
 * out of the web bundle.
 */
export function HeaderDragZone({
  dragY,
  onDismiss,
  minHeight,
  children,
}: IHeaderDragZoneProps) {
  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY([-10, 10])
        .failOffsetX([-20, 20])
        .hitSlop({ top: 8, bottom: 8 })
        .onUpdate((event) => {
          'worklet';

          dragY.value =
            event.translationY >= 0
              ? event.translationY
              : event.translationY * HEADER_DRAG_UPWARD_RESISTANCE;
        })
        .onEnd((event, success) => {
          'worklet';

          // A cancelled or failed pan reaches here too, carrying its last
          // translation and velocity, so only a completed pull may let go of
          // the sheet. A flick counts only while the sheet sits below its
          // resting position: a rubber-band pull-up released with downward
          // momentum springs back rather than dismissing.
          const shouldDismiss =
            success &&
            (event.translationY > HEADER_DRAG_DISMISS_DISTANCE ||
              (event.translationY > 0 &&
                event.velocityY > HEADER_DRAG_DISMISS_VELOCITY));
          if (shouldDismiss) {
            runOnJS(onDismiss)();
            return;
          }
          dragY.value = withSpring(0, HEADER_DRAG_SPRING);
        }),
    [dragY, onDismiss],
  );
  return (
    <GestureDetector gesture={gesture}>
      <Stack collapsable={false} minHeight={minHeight}>
        {children}
      </Stack>
    </GestureDetector>
  );
}
