export const FLICK_VELOCITY_THRESHOLD = 500;

export interface IComputeSwipeTargetParams {
  progress: number;
  velocityX: number;
  minIndex: number;
  maxIndex: number;
}

/**
 * Decides which month page to settle on after a swipe release.
 *
 * - fast flick: move one page in the flick direction from the drag position
 * - slow release: snap to the nearest page
 * - always clamped to [minIndex, maxIndex]; a bound collapses onto the
 *   current page when the neighboring month is outside minDate/maxDate
 *
 * Intentionally mirrors packages/kit/src/views/AppUpdate/components/FeaturedCarousel/computeTargetIndex.ts;
 * cannot import it because @onekeyhq/components must not depend on @onekeyhq/kit.
 */
export function computeSwipeTarget({
  progress,
  velocityX,
  minIndex,
  maxIndex,
}: IComputeSwipeTargetParams): number {
  'worklet';

  // keep inside the worklet: a module-scope helper would not be a worklet on the UI thread
  const clamp = (n: number) => Math.max(minIndex, Math.min(maxIndex, n));
  if (velocityX < -FLICK_VELOCITY_THRESHOLD) {
    return clamp(Math.floor(progress) + 1);
  }
  if (velocityX > FLICK_VELOCITY_THRESHOLD) {
    return clamp(Math.ceil(progress) - 1);
  }
  return clamp(Math.round(progress));
}
