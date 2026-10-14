import { EAppEventBusNames, appEventBus } from '../eventBus/appEventBus';

// The bottom tab bar stays hidden while ANY screen still requests it.
//
// `EAppEventBusNames.HideTabBar` carries a bare boolean, so a direct emit makes
// the last writer win. That breaks when two instances of the same screen
// overlap: during a market detail stack collapse the leaving instance runs its
// focus cleanup after the surviving instance already asked for a hidden tab
// bar, and its `false` resurrects the tab bar over the surviving screen.
// Routing every writer through this registry keeps the resolved state a union
// of live requests instead.
const hideRequestOwners = new Set<string>();

let ownerSeq = 0;

/**
 * Builds an owner id for a screen instance. Screens that can have two live
 * instances at once (market detail during a stack collapse) MUST hold a
 * per-instance id, otherwise a leaving instance releases the survivor's request.
 */
export function createHideTabBarOwnerId(scope: string) {
  ownerSeq += 1;
  return `${scope}#${ownerSeq}`;
}

function emitResolvedTabBarVisibility() {
  appEventBus.emit(EAppEventBusNames.HideTabBar, hideRequestOwners.size > 0);
}

export function setHideTabBarRequest(ownerId: string, hidden: boolean) {
  if (hidden) {
    hideRequestOwners.add(ownerId);
  } else {
    hideRequestOwners.delete(ownerId);
  }
  emitResolvedTabBarVisibility();
}

export function requestHideTabBar(ownerId: string) {
  setHideTabBarRequest(ownerId, true);
}

export function releaseHideTabBar(ownerId: string) {
  setHideTabBarRequest(ownerId, false);
}

export function isTabBarHiddenByRequest() {
  return hideRequestOwners.size > 0;
}

export function clearHideTabBarRequests() {
  hideRequestOwners.clear();
  emitResolvedTabBarVisibility();
}
