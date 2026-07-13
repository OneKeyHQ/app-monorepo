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
 *   - Settled on a slide AND no spring in flight: target changes are
 *     post-settlement measurement updates (dialog scale-in, webfont swap,
 *     deferred remeasure) — snap, otherwise the height visibly climbs after
 *     open.
 *   - Rounded slide index changed, or a spring is mid-flight: spring smoothly
 *     to the new target. Without the in-flight guard, a slide's onLayout (or
 *     its deferred remeasures) firing during the transition would re-enter
 *     the snap branch and short-circuit the spring.
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
  // Cleared only on natural spring completion; cancelled springs keep this
  // true so a chained re-target stays in spring mode end to end.
  const isSpringing = useSharedValue(false);

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

      if (
        isStable &&
        lastSnappedRounded.value === rounded &&
        !isSpringing.value
      ) {
        if (heightSpring.value !== target) heightSpring.value = target;
        return;
      }

      if (isStable) lastSnappedRounded.value = rounded;

      if (prev !== null && Math.abs(target - prev) < 1) return;
      isSpringing.value = true;
      heightSpring.value = withDelay(
        HEIGHT_SPRING_DELAY_MS,
        withSpring(target, HEIGHT_SPRING_CONFIG, (finished) => {
          'worklet';

          if (finished) isSpringing.value = false;
        }),
      );
    },
  );

  return heightSpring;
}
