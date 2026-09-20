import { useEffect, useRef, useState } from 'react';

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
// Panes that mount inactive were never visible, so they freeze right away
// instead of paying a full render for nothing.
//
// A frozen pane renders nothing, so it cannot notice that its inputs changed.
// `thawKey` names the inputs a pane must react to even while it is inactive:
// when it changes, the pane thaws for one freeze delay, renders with the new
// inputs so its own effects run, and freezes again.
export function useHomeTabFreeze(isActive: boolean, thawKey?: string) {
  const [frozen, setFrozen] = useState(() => !isActive);
  const thawKeyRef = useRef(thawKey);
  useEffect(() => {
    const thawKeyChanged = thawKeyRef.current !== thawKey;
    thawKeyRef.current = thawKey;
    if (isActive) {
      setFrozen(false);
      return undefined;
    }
    if (thawKeyChanged) {
      setFrozen(false);
    }
    const timer = setTimeout(() => {
      setFrozen(true);
    }, HOME_TAB_FREEZE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [isActive, thawKey]);
  return isActive ? false : frozen;
}
