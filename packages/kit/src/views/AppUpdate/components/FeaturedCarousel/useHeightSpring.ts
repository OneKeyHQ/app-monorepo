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
// progress is treated as "settled on a slide" within this tolerance, so we
// snap instead of spring (avoids slow catch-up on layout-driven re-measures).
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
    () =>
      interpolateHeight({
        progress: progress.value,
        heights: measuredHeights.value,
        fallback: ESTIMATED_FALLBACK_HEIGHT,
      }),
    (target, prev) => {
      // Snap on measurement-only changes (steady-state re-layout from the
      // dialog scale animation or webfont swap); spring only during real
      // slide-to-slide transitions, otherwise the height visibly climbs
      // after the dialog opens.
      const isStableProgress =
        Math.abs(progress.value - Math.round(progress.value)) <
        PROGRESS_SNAP_TOLERANCE;
      if (isStableProgress) {
        if (heightSpring.value !== target) heightSpring.value = target;
        return;
      }
      if (prev !== null && Math.abs(target - prev) < 1) return;
      heightSpring.value = withDelay(
        HEIGHT_SPRING_DELAY_MS,
        withSpring(target, HEIGHT_SPRING_CONFIG),
      );
    },
  );

  return heightSpring;
}
