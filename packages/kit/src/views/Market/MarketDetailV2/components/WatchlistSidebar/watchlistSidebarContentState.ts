export type IWatchlistSidebarContentState =
  | 'recommendations'
  | 'skeleton'
  | 'loadFailed'
  | 'rows';

// Which body the favorites sidebar shows. Recommendations stand in only when
// nothing is stored, or when every source loaded and still no row resolved
// (a delisted perp, a token the batch API drops): those favorites leave
// nothing the user can see or remove (OK-65655). Desktop and web report a
// failed request only through `hasLoadedAllSources`, so an empty list that
// did not load reads as a failure with a retry, not as an empty watchlist.
export function getWatchlistSidebarContentState({
  isMounted,
  storedCount,
  isLoading,
  isError,
  hasLoadedAllSources,
  rowCount,
}: {
  isMounted: boolean;
  storedCount: number;
  isLoading: boolean;
  isError: boolean;
  hasLoadedAllSources: boolean;
  rowCount: number;
}): IWatchlistSidebarContentState {
  if (!isMounted) {
    return 'skeleton';
  }
  if (storedCount === 0) {
    return 'recommendations';
  }
  if (rowCount > 0) {
    return 'rows';
  }
  if (isLoading) {
    return 'skeleton';
  }
  if (isError || !hasLoadedAllSources) {
    return 'loadFailed';
  }
  return 'recommendations';
}
