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
// progress is treated as "settled on a slide" within this tolerance.
const PROGRESS_SNAP_TOLERANCE = 0.01;

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
    () => ({
      target: interpolateHeight({
        progress: progress.value,
        heights: measuredHeights.value,
        fallback: ESTIMATED_FALLBACK_HEIGHT,
      }),
      rounded: Math.round(progress.value),
      isStable:
        Math.abs(progress.value - Math.round(progress.value)) <
        PROGRESS_SNAP_TOLERANCE,
    }),
    (curr, prev) => {
      // Snap only on pure re-measurement (no slide change, progress settled).
      // This handles the dialog scale animation / webfont swap that would
      // otherwise spring through intermediate measured heights and look like
      // a slow climb. A tap-jump to another slide also makes progress stable,
      // but the rounded index changed — that case should spring.
      const slideChanged = prev !== null && prev.rounded !== curr.rounded;
      if (curr.isStable && !slideChanged) {
        if (heightSpring.value !== curr.target) heightSpring.value = curr.target;
        return;
      }
      if (prev !== null && Math.abs(curr.target - prev.target) < 1) return;
      heightSpring.value = withDelay(
        HEIGHT_SPRING_DELAY_MS,
        withSpring(curr.target, HEIGHT_SPRING_CONFIG),
      );
    },
  );

  return heightSpring;
}
