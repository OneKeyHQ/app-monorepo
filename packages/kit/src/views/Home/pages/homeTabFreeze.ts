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
// Panes that mount inactive were never visible, so they freeze right away
// instead of paying a full render for nothing.
export function useHomeTabFreeze(isActive: boolean) {
  const [frozen, setFrozen] = useState(() => !isActive);
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

// A frozen pane never re-renders, so a pane that feeds always-visible state
// (the wallet pane feeds the header worth and WalletActions) would keep
// serving the previous owner after an account switch made while another tab
// is focused: no fetch starts, no replay lands, and the header stays stale
// until the user returns to that tab. Report `true` for the render cycle in
// which the owner changed so the pane thaws for one commit, lets its hooks
// observe the new owner and start the refresh; the freeze delay then
// re-freezes it. A same-owner network switch keeps its own refresh path.
export function useHomeTabOwnerThaw(ownerKey: string | undefined) {
  const [renderedOwnerKey, setRenderedOwnerKey] = useState(ownerKey);
  useEffect(() => {
    setRenderedOwnerKey(ownerKey);
  }, [ownerKey]);
  return renderedOwnerKey !== ownerKey;
}
