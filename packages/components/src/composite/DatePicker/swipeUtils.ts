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
  startProgress: number;
  committedIndex: number;
  velocityX: number;
  minIndex: number;
  maxIndex: number;
}

/**
 * Decides which month page to settle on after a swipe release.
 *
 * - fast flick: move one page in the flick direction from the gesture's drag,
 *   rebased onto `committedIndex` (see below)
 * - slow release: snap to the page nearest the on-screen position
 * - always clamped to [minIndex, maxIndex]; a bound collapses onto the
 *   current page when the neighboring month is outside minDate/maxDate
 *
 * Fast flicks use `committedIndex + (progress - startProgress)` instead of the
 * raw on-screen `progress`: a gesture that starts mid-spring (a chained swipe
 * interrupting the previous settle) begins with `progress` still lagging
 * behind the already-committed index, so floor/ceil on the raw value would
 * resolve the flick back onto the committed page and the commit would no-op,
 * silently swallowing the second month change. When the gesture starts from a
 * settled page, `startProgress === committedIndex` and the rebase is an
 * identity. Slow releases keep the raw position so the pager settles on
 * whichever page is visually closest.
 *
 * Mirrors the shape of packages/kit/src/views/AppUpdate/components/FeaturedCarousel/computeTargetIndex.ts
 * (cannot import it: @onekeyhq/components must not depend on @onekeyhq/kit),
 * plus the committed-index rebase, which the carousel does not need because it
 * has no external month-commit state to keep in lockstep with.
 */
export function computeSwipeTarget({
  progress,
  startProgress,
  committedIndex,
  velocityX,
  minIndex,
  maxIndex,
}: IComputeSwipeTargetParams): number {
  'worklet';

  // keep inside the worklet: a module-scope helper would not be a worklet on the UI thread
  const clamp = (n: number) => Math.max(minIndex, Math.min(maxIndex, n));
  const effective = committedIndex + (progress - startProgress);
  if (velocityX < -FLICK_VELOCITY_THRESHOLD) {
    return clamp(Math.floor(effective) + 1);
  }
  if (velocityX > FLICK_VELOCITY_THRESHOLD) {
    return clamp(Math.ceil(effective) - 1);
  }
  return clamp(Math.round(progress));
}
