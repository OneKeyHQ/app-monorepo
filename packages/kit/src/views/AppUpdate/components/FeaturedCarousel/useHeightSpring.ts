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
const PROGRESS_SNAP_TOLERANCE = 0.01;

interface IUseHeightSpringParams {
  progress: SharedValue<number>;
  measuredHeights: SharedValue<number[]>;
}

/**
 * Returns a shared value tracking the desired container height for the content
 * area below the media.
 *
 * Snap vs spring policy:
 *   - On the same slide we already settled on, target changes are measurement
 *     updates from the dialog scale-in / webfont swap — snap, otherwise the
 *     height visibly climbs after open.
 *   - When the rounded slide index changes (tap-jump that sets progress to a
 *     new integer, or a swipe that crosses a midpoint), spring smoothly to the
 *     new target.
 *
 * IMPORTANT: prepare must return a primitive number — useAnimatedReaction does
 * reference equality on the return value, so an object literal would fire the
 * reaction every frame and the snap branch would keep interrupting the spring.
 */
export function useHeightSpring({
  progress,
  measuredHeights,
}: IUseHeightSpringParams) {
  const heightSpring = useSharedValue(ESTIMATED_FALLBACK_HEIGHT);
  const lastSnappedRounded = useSharedValue(0);

  useAnimatedReaction(
    () =>
      interpolateHeight({
        progress: progress.value,
        heights: measuredHeights.value,
        fallback: ESTIMATED_FALLBACK_HEIGHT,
      }),
    (target, prev) => {
      const rounded = Math.round(progress.value);
      const isStable =
        Math.abs(progress.value - rounded) < PROGRESS_SNAP_TOLERANCE;

      if (isStable && lastSnappedRounded.value === rounded) {
        if (heightSpring.value !== target) heightSpring.value = target;
        return;
      }

      if (isStable) lastSnappedRounded.value = rounded;

      if (prev !== null && Math.abs(target - prev) < 1) return;
      heightSpring.value = withDelay(
        HEIGHT_SPRING_DELAY_MS,
        withSpring(target, HEIGHT_SPRING_CONFIG),
      );
    },
  );

  return heightSpring;
}
