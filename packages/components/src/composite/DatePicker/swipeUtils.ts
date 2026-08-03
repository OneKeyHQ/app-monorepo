export const FLICK_VELOCITY_THRESHOLD = 500;

export interface IComputeCommitOffsetDateParams {
  anchorMonth: Date;
  delta: number;
  minDate?: Date;
}

/**
 * Absolute offsetDate to dispatch when the pager commits a swipe of `delta`
 * months away from `anchorMonth` (any date inside the currently committed
 * month).
 *
 * Uses first-of-month so the result is independent of rehookify's current
 * offsetDate: queued commits from chained swipes each advance the anchor one
 * month, where relative addOffset/subtractOffset getters would reuse the
 * offsetDate captured before the first commit re-rendered and dispatch the
 * same month twice.
 *
 * When the target month contains minDate, first-of-month would sit before it
 * and rehookify's setOffset would refuse the (valid) month, so land on
 * minDate itself. Returns null when the whole target month is before minDate;
 * the max edge needs no handling here because first-of-month never exceeds
 * maxDate unless the whole month is out of range, which setOffset's own
 * disabled check refuses.
 */
export function computeCommitOffsetDate({
  anchorMonth,
  delta,
  minDate,
}: IComputeCommitOffsetDateParams): Date | null {
  const monthFirst = new Date(
    anchorMonth.getFullYear(),
    anchorMonth.getMonth() + delta,
    1,
  );
  const next = minDate && monthFirst < minDate ? minDate : monthFirst;
  if (
    next.getFullYear() !== monthFirst.getFullYear() ||
    next.getMonth() !== monthFirst.getMonth()
  ) {
    return null;
  }
  return next;
}

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
