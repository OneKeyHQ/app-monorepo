import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  type IMarketSearchTab,
  MARKET_SEARCH_TABS,
  getDetailPopoverSearchTabs,
} from '../../../utils/marketSearchList';

import { useMarketStockSelectorList } from './useMarketStockSelectorList';

import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

export function useMarketTokenSelectorSearchState(
  query: string,
  // True while tokens load or when there are any; hides the Tokens tab
  // otherwise.
  hasTokenResults = true,
) {
  const [activeTab, setActiveTab] = useState<IMarketSearchTab>(
    MARKET_SEARCH_TABS.all,
  );
  const [showAllStocks, setShowAllStocks] = useState(false);
  const [showAllTokens, setShowAllTokens] = useState(false);
  const stockResult = useMarketStockSelectorList({
    query,
    searchOnly: true,
  });
  const hasStockResults = stockResult.items.length > 0;
  const visibleTabs = useMemo(
    () => getDetailPopoverSearchTabs(hasStockResults, hasTokenResults),
    [hasStockResults, hasTokenResults],
  );
  const hasQuery = Boolean(query.trim());

  useEffect(() => {
    setActiveTab(MARKET_SEARCH_TABS.all);
    setShowAllStocks(false);
    setShowAllTokens(false);
  }, [query]);

  useEffect(() => {
    if (!visibleTabs.includes(activeTab)) {
      setActiveTab(MARKET_SEARCH_TABS.all);
    }
  }, [activeTab, visibleTabs]);

  const showSectionTitle = hasQuery && activeTab === MARKET_SEARCH_TABS.all;

  return {
    activeTab,
    setActiveTab,
    showAllStocks,
    setShowAllStocks,
    showAllTokens,
    setShowAllTokens,
    stockResult,
    hasStockResults,
    showSectionTitle,
  };
}

export { MARKET_SEARCH_TABS };

// Starts the next page this close to the end of the scrolled content.
const LOAD_MORE_THRESHOLD = 200;

/**
 * Loads the next stock page when the All tab is scrolled near its end. Only
 * used when stocks are the sole section: All then lists every stock, and the
 * stock search is paginated while the token search is not.
 */
export function useStockLoadMoreOnScrollEnd(
  stockResult: ReturnType<typeof useMarketStockSelectorList>,
  enabled: boolean,
) {
  const {
    canLoadMore,
    isLoadingMore,
    isLoadMoreError,
    isRevalidatingFirstPage,
    loadMore,
  } = stockResult;
  return useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!enabled || isLoadingMore || isLoadMoreError) {
        return;
      }
      if (!canLoadMore && !isRevalidatingFirstPage) {
        return;
      }
      const { contentOffset, layoutMeasurement, contentSize } =
        event.nativeEvent;
      if (
        contentOffset.y + layoutMeasurement.height >=
        contentSize.height - LOAD_MORE_THRESHOLD
      ) {
        void loadMore();
      }
    },
    [
      canLoadMore,
      enabled,
      isLoadMoreError,
      isLoadingMore,
      isRevalidatingFirstPage,
      loadMore,
    ],
  );
}
