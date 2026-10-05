export type IMobileDetailTabKey = 'portfolio' | 'info' | 'protocol';

// Portfolio needs a position and Protocol needs intro data (Lista sends none,
// OK-62925); Info is always there.
export function resolveVisibleTabKeys({
  hasPortfolio,
  hasProtocol,
}: {
  hasPortfolio: boolean;
  hasProtocol: boolean;
}): IMobileDetailTabKey[] {
  return [
    ...(hasPortfolio ? (['portfolio'] as const) : []),
    'info',
    ...(hasProtocol ? (['protocol'] as const) : []),
  ];
}

export function resolveDefaultTabKey({
  hasPortfolio,
}: {
  hasPortfolio: boolean;
}): IMobileDetailTabKey {
  return hasPortfolio ? 'portfolio' : 'info';
}

// The detail page stays mounted across account switches, so a tab the user
// picked can disappear under them (A has a position, B does not). Fall back to
// the default rather than rendering an empty body.
export function resolveActiveTabKey({
  selectedKey,
  visibleKeys,
  defaultKey,
}: {
  selectedKey: IMobileDetailTabKey | undefined;
  visibleKeys: IMobileDetailTabKey[];
  defaultKey: IMobileDetailTabKey;
}): IMobileDetailTabKey {
  if (selectedKey && visibleKeys.includes(selectedKey)) {
    return selectedKey;
  }
  return visibleKeys.includes(defaultKey) ? defaultKey : visibleKeys[0];
}

/** A release faster than this settles one page in the flick direction. */
export const PAGER_FLICK_VELOCITY = 500;

/**
 * Where the pager settles after the finger lifts: a flick moves one page in
 * its direction from wherever the drag got to, anything slower lands on the
 * nearest page. Worklet-safe on purpose — it runs on the UI thread.
 */
export function resolveSettleIndex({
  progress,
  velocityX,
  count,
}: {
  progress: number;
  velocityX: number;
  count: number;
}): number {
  'worklet';

  const maxIndex = Math.max(count - 1, 0);
  const clamp = (n: number) => Math.max(0, Math.min(maxIndex, n));
  if (velocityX < -PAGER_FLICK_VELOCITY) {
    return clamp(Math.floor(progress) + 1);
  }
  if (velocityX > PAGER_FLICK_VELOCITY) {
    return clamp(Math.ceil(progress) - 1);
  }
  return clamp(Math.round(progress));
}

/**
 * Container height while the pager sits between two pages of different
 * heights: a straight blend of the neighbors, so the content below the tabs
 * slides along with the page instead of jumping when the page lands. A page
 * that has not reported a height yet counts as `fallback`.
 */
export function interpolatePageHeight({
  progress,
  heights,
  fallback,
}: {
  progress: number;
  heights: number[];
  fallback: number;
}): number {
  'worklet';

  if (heights.length === 0) {
    return fallback;
  }
  const maxIndex = heights.length - 1;
  const clamped = Math.max(0, Math.min(maxIndex, progress));
  const lower = Math.floor(clamped);
  const upper = Math.ceil(clamped);
  const fraction = clamped - lower;
  const lowerHeight = heights[lower] || fallback;
  const upperHeight = heights[upper] || fallback;
  return lowerHeight + (upperHeight - lowerHeight) * fraction;
}
