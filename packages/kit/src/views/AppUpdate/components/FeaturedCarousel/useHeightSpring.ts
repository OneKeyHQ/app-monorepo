import {
  useAnimatedReaction,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';

import { HEIGHT_SPRING_CONFIG, HEIGHT_SPRING_DELAY_MS } from './constants';
import { interpolateHeight } from './interpolateHeight';

import type { SharedValue } from 'react-native-reanimated';

const ESTIMATED_FALLBACK_HEIGHT = 100;

interface IUseHeightSpringParams {
  progress: SharedValue<number>;
  measuredHeights: SharedValue<number[]>;
}

/**
 * Returns a shared value tracking the desired container height for the content
 * area below the media. Springs with HEIGHT_SPRING_DELAY_MS lag behind the
 * progress-driven contentHeight target.
 */
export function useHeightSpring({
  progress,
  measuredHeights,
}: IUseHeightSpringParams) {
  const heightSpring = useSharedValue(ESTIMATED_FALLBACK_HEIGHT);

  useAnimatedReaction(
    () =>
      interpolateHeight({
        progress: progress.value,
        heights: measuredHeights.value,
        fallback: ESTIMATED_FALLBACK_HEIGHT,
      }),
    (target, prev) => {
      // Skip restarting the spring on sub-pixel changes — during a continuous
      // swipe this reaction runs ~60fps and would otherwise preempt every
      // in-flight spring, defeating the lag and overshoot.
      if (prev !== null && Math.abs(target - prev) < 1) return;
      heightSpring.value = withDelay(
        HEIGHT_SPRING_DELAY_MS,
        withSpring(target, HEIGHT_SPRING_CONFIG),
      );
    },
  );

  return heightSpring;
}
