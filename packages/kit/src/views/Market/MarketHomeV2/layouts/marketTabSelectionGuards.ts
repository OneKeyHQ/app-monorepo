// Guards for market tab/category selection state that lives in the bg-synced
// `marketSelectedTabAtom`. On runtimes where UI atom writes are proxied to the
// bg runtime (production native, extension UI), the UI mirror only updates
// after a bg round-trip, so values read from the atom can be stale for tens to
// hundreds of milliseconds after a local write. Deriving tab targets from the
// stale mirror is what made the pager revert the user's tab selection
// (OK-57367).

interface IShouldRestoreSpotCategoryFromAtomParams {
  pendingSpotCategoryId?: string;
  atomSpotCategoryId: string;
}

/**
 * Whether the atom's `selectedSpotCategory` may be restored into the local
 * `selectedCategory` state. Restoring is only safe when no local selection is
 * awaiting its atom echo (cold-start restore) or when the atom has caught up
 * with the latest local selection; otherwise the stale echo would revert the
 * user's category choice.
 */
export function shouldRestoreSpotCategoryFromAtom({
  pendingSpotCategoryId,
  atomSpotCategoryId,
}: IShouldRestoreSpotCategoryFromAtomParams): boolean {
  if (!pendingSpotCategoryId) {
    return true;
  }
  return atomSpotCategoryId === pendingSpotCategoryId;
}

export interface IMarketTabWrittenSelection {
  tab: string;
  categoryId?: string;
}

interface IGetIsMarketTabSelectionInFlightParams {
  lastWrittenSelection?: IMarketTabWrittenSelection;
  atomTab: string;
  atomSpotCategoryId?: string;
}

/**
 * A tab selection written to the bg-synced atom stays "in flight" until the
 * UI mirror echoes back the written tab (and category, when one was written).
 * While in flight, `selectedTabName` derived from the mirror is stale and
 * must not drive a programmatic pager jump.
 */
export function getIsMarketTabSelectionInFlight({
  lastWrittenSelection,
  atomTab,
  atomSpotCategoryId,
}: IGetIsMarketTabSelectionInFlightParams): boolean {
  if (!lastWrittenSelection) {
    return false;
  }
  if (atomTab !== lastWrittenSelection.tab) {
    return true;
  }
  if (
    lastWrittenSelection.categoryId &&
    atomSpotCategoryId !== lastWrittenSelection.categoryId
  ) {
    return true;
  }
  return false;
}

interface IShouldIgnoreStalePagerTabChangeParams {
  expectedTabName?: string;
  incomingTabName: string;
  selectedTabName: string;
  isRecentPagerDrag: boolean;
}

export function shouldIgnoreStalePagerTabChange({
  expectedTabName,
  incomingTabName,
  selectedTabName,
  isRecentPagerDrag,
}: IShouldIgnoreStalePagerTabChangeParams): boolean {
  return Boolean(
    !expectedTabName &&
    incomingTabName !== selectedTabName &&
    !isRecentPagerDrag,
  );
}
