export type IMobileDetailTabKey = 'portfolio' | 'info' | 'protocol';

export function resolveVisibleTabKeys({
  hasPortfolio,
}: {
  hasPortfolio: boolean;
}): IMobileDetailTabKey[] {
  return hasPortfolio
    ? ['portfolio', 'info', 'protocol']
    : ['info', 'protocol'];
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

// A swipe on the tab body moves one tab over, with no paging animation: the
// body swaps the way it does on a tab-bar tap (OK-62395). A swipe commits when
// it is either far enough (a quarter of the body width) or a flick in the same
// direction; a short, slow drift is a scroll that wandered sideways and is
// ignored. There is no wrap-around, so a swipe past either end does nothing.
export const SWIPE_DISTANCE_RATIO = 0.25;
export const SWIPE_VELOCITY_THRESHOLD = 500;

export function resolveSwipeTargetKey({
  activeKey,
  visibleKeys,
  translationX,
  velocityX,
  width,
}: {
  activeKey: IMobileDetailTabKey;
  visibleKeys: IMobileDetailTabKey[];
  translationX: number;
  velocityX: number;
  width: number;
}): IMobileDetailTabKey | undefined {
  const index = visibleKeys.indexOf(activeKey);
  if (index < 0 || width <= 0 || translationX === 0) {
    return undefined;
  }
  const farEnough = Math.abs(translationX) >= width * SWIPE_DISTANCE_RATIO;
  const flicked =
    Math.abs(velocityX) >= SWIPE_VELOCITY_THRESHOLD &&
    Math.sign(velocityX) === Math.sign(translationX);
  if (!farEnough && !flicked) {
    return undefined;
  }
  // Dragging left reveals the tab to the right.
  return visibleKeys[translationX < 0 ? index + 1 : index - 1];
}
