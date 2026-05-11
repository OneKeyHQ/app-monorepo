const FLICK_VELOCITY_THRESHOLD = 500;

export interface IComputeTargetIndexParams {
  progress: number;
  velocityX: number;
  count: number;
}

/**
 * Decides which slide index to settle on after a gesture release.
 *
 * - velocity exceeds threshold: flick forward (negative velocityX) or backward (positive)
 *   one step from the floor/ceil of progress
 * - otherwise: round progress to nearest integer
 * - always clamped to [0, count - 1]
 */
export function computeTargetIndex({
  progress,
  velocityX,
  count,
}: IComputeTargetIndexParams): number {
  'worklet';

  const maxIndex = Math.max(count - 1, 0);
  const clamp = (n: number) => Math.max(0, Math.min(maxIndex, n));

  if (velocityX < -FLICK_VELOCITY_THRESHOLD) {
    return clamp(Math.floor(progress) + 1);
  }
  if (velocityX > FLICK_VELOCITY_THRESHOLD) {
    return clamp(Math.ceil(progress) - 1);
  }
  return clamp(Math.round(progress));
}
