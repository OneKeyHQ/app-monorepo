export interface IInterpolateHeightParams {
  progress: number;
  heights: number[];
  fallback: number;
}

/**
 * Linearly interpolates the height between adjacent measured slides based on continuous progress.
 *
 * Slides with height 0 (unmeasured) use `fallback`. Progress is clamped to [0, heights.length - 1].
 *
 * MUST be a worklet-safe pure function — no closures over external state, no Date.now, etc.
 */
export function interpolateHeight({
  progress,
  heights,
  fallback,
}: IInterpolateHeightParams): number {
  'worklet';

  if (heights.length === 0) return fallback;

  const maxIndex = heights.length - 1;
  const clamped = Math.max(0, Math.min(maxIndex, progress));
  const lower = Math.floor(clamped);
  const upper = Math.ceil(clamped);
  const fraction = clamped - lower;

  const lowerHeight = heights[lower] || fallback;
  const upperHeight = heights[upper] || fallback;

  return lowerHeight + (upperHeight - lowerHeight) * fraction;
}
