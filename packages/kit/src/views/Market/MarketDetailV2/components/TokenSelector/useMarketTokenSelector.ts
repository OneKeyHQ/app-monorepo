import { useCallback, useState } from 'react';

import { useDebounce } from '@onekeyhq/kit/src/hooks/useDebounce';

export type IMarketTokenSelectorTab = 'watchlist' | 'spot' | 'futures';

export function useMarketTokenSelector() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] =
    useState<IMarketTokenSelectorTab>('watchlist');

  const debouncedQuery = useDebounce(searchQuery, 300);

  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text.slice(0, 64).trim());
  }, []);

  const handleTabChange = useCallback((tab: IMarketTokenSelectorTab) => {
    setActiveTab(tab);
  }, []);

  return {
    searchQuery,
    debouncedQuery,
    activeTab,
    handleSearchChange,
    handleTabChange,
  };
}
