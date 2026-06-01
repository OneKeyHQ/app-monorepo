import { useMemo } from 'react';

import { Gesture } from 'react-native-gesture-handler';
import {
  cancelAnimation,
  runOnJS,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { computeTargetIndex } from './computeTargetIndex';
import {
  CONTENT_SPRING_CONFIG,
  PAN_ACTIVE_OFFSET_X,
  PAN_FAIL_OFFSET_Y,
} from './constants';

import type { SharedValue } from 'react-native-reanimated';

interface IUseCarouselGestureParams {
  progress: SharedValue<number>;
  slideWidth: number;
  count: number;
  onCommit: (targetIndex: number) => void;
  enabled: boolean;
}

export function useCarouselGesture({
  progress,
  slideWidth,
  count,
  onCommit,
  enabled,
}: IUseCarouselGestureParams) {
  const startProgress = useSharedValue(0);

  return useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX(PAN_ACTIVE_OFFSET_X)
        .failOffsetY(PAN_FAIL_OFFSET_Y)
        .enabled(enabled && slideWidth > 0 && count > 1)
        .onStart(() => {
          'worklet';

          cancelAnimation(progress);
          startProgress.value = progress.value;
        })
        .onUpdate((e) => {
          'worklet';

          if (slideWidth <= 0) return;
          let next = startProgress.value - e.translationX / slideWidth;

          // Rubber-band clamp: damping outside [0, count-1]
          const maxIndex = count - 1;
          if (next < 0) next *= 0.33;
          if (next > maxIndex) next = maxIndex + (next - maxIndex) * 0.33;

          progress.value = next;
        })
        .onEnd((e) => {
          'worklet';

          const target = computeTargetIndex({
            progress: progress.value,
            velocityX: e.velocityX,
            count,
          });
          progress.value = withSpring(target, CONTENT_SPRING_CONFIG);
          runOnJS(onCommit)(target);
        }),
    [enabled, slideWidth, count, progress, startProgress, onCommit],
  );
}
