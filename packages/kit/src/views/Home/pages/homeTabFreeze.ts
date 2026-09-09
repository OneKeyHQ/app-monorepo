import { useEffect, useState } from 'react';

// How long an inactive home tab pane stays rendered after it loses focus.
// The collapsible tab pager slides for ~300 ms and keeps re-syncing the new
// tab's scroll offset for ~250 ms after the index flips (which happens at the
// half-way point of the slide). Freezing before that leaves the pane the user
// is sliding away from blank mid-animation.
export const HOME_TAB_FREEZE_DELAY_MS = 500;

export function isHomeTabActive({
  tabName,
  focusedTab,
  pressedTabName,
}: {
  tabName: string;
  focusedTab: string | undefined;
  pressedTabName: string | undefined;
}) {
  if (!focusedTab) {
    return true;
  }
  return focusedTab === tabName || pressedTabName === tabName;
}

// `true` while the pane should be frozen. Unfreezing is immediate; freezing
// waits HOME_TAB_FREEZE_DELAY_MS so the pane survives the pager animation.
export function useHomeTabFreeze(isActive: boolean) {
  const [frozen, setFrozen] = useState(false);
  useEffect(() => {
    if (isActive) {
      setFrozen(false);
      return undefined;
    }
    const timer = setTimeout(() => {
      setFrozen(true);
    }, HOME_TAB_FREEZE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [isActive]);
  return isActive ? false : frozen;
}
