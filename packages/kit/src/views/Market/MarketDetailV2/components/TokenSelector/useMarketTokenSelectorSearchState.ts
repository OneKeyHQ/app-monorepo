import { useEffect, useMemo, useState } from 'react';

import {
  type IMarketSearchTab,
  MARKET_SEARCH_TABS,
  getDetailPopoverSearchTabs,
} from '../../../utils/marketSearchList';

import { useMarketStockSelectorList } from './useMarketStockSelectorList';

export function useMarketTokenSelectorSearchState(query: string) {
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
    () => getDetailPopoverSearchTabs(hasStockResults),
    [hasStockResults],
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
