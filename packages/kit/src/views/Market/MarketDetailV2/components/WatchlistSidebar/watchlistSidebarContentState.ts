import type { IWatchlistFilterType } from '../../../MarketHomeV2/components/MarketTokenList/MarketWatchlistCategorySelector';

export type IWatchlistSidebarContentState =
  | 'recommendations'
  | 'noResults'
  | 'skeleton'
  | 'loadFailed'
  | 'rows';

// Which body the favorites sidebar shows. Recommendations stand in only when
// nothing is stored, or when every source loaded and still no row resolved
// (a delisted perp, a token the batch API drops): those favorites leave
// nothing the user can see or remove (OK-65655). Desktop and web report a
// failed request only through `hasLoadedAllSources`, so an empty list that
// did not load reads as a failure with a retry, not as an empty watchlist.
// The recommendations are spot tokens, so the Stocks and Perps filters read as
// an empty list instead, as in the token selector's Favorites tab.
export function getWatchlistSidebarContentState({
  isMounted,
  storedCount,
  isLoading,
  isError,
  hasLoadedAllSources,
  rowCount,
  filter,
}: {
  isMounted: boolean;
  storedCount: number;
  isLoading: boolean;
  isError: boolean;
  hasLoadedAllSources: boolean;
  rowCount: number;
  filter: IWatchlistFilterType;
}): IWatchlistSidebarContentState {
  const emptyState =
    filter === 'all' || filter === 'spot' ? 'recommendations' : 'noResults';
  if (!isMounted) {
    return 'skeleton';
  }
  if (storedCount === 0) {
    return emptyState;
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
  return emptyState;
}
