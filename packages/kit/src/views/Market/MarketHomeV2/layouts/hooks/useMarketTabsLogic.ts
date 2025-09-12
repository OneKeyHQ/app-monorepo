import { useCallback, useEffect, useMemo, useRef } from 'react';

import { useIntl } from 'react-intl';
import { useSharedValue } from 'react-native-reanimated';
import { useDebouncedCallback } from 'use-debounce';

import type { ICarouselInstance } from '@onekeyhq/components';
import { useSelectedMarketTabAtom } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import type { IMarketHomeTabValue } from '../../types';
import type { SharedValue } from 'react-native-reanimated';

export interface IMarketTabsLogicReturn {
  // Tab related data
  tabNames: string[];
  watchlistTabName: string;
  trendingTabName: string;

  // Tab control
  focusedTab: SharedValue<string>;
  carouselRef: React.RefObject<ICarouselInstance | null>;
  handleTabChange: (tabName: string) => void;
  handlePageChanged: (index: number) => void;
  defaultIndex: number;

  // State
  selectedTab: string;
}

export function useMarketTabsLogic(
  onTabChange: (tabId: IMarketHomeTabValue) => void,
): IMarketTabsLogicReturn {
  const intl = useIntl();
  const [selectedTab, setSelectedTab] = useSelectedMarketTabAtom();

  const watchlistTabName = intl.formatMessage({
    id: ETranslations.global_watchlist,
  });
  const trendingTabName = intl.formatMessage({
    id: ETranslations.market_trending,
  });

  const carouselRef = useRef<ICarouselInstance>(null);
  const tabNames = useMemo(() => {
    return [watchlistTabName, trendingTabName];
  }, [watchlistTabName, trendingTabName]);

  // Use the selected tab from global state, default to trending if not set
  const initialTabName = useMemo(() => {
    if (selectedTab === 'watchlist') return watchlistTabName;
    return trendingTabName; // default to trending
  }, [selectedTab, watchlistTabName, trendingTabName]);

  // Create a SharedValue that always syncs with the atom state
  const focusedTab = useSharedValue(initialTabName);

  // Ensure focusedTab always syncs with selectedTab state
  useEffect(() => {
    focusedTab.value = initialTabName;
  }, [focusedTab, initialTabName]);

  const defaultIndex = useMemo(() => {
    return selectedTab === 'watchlist' ? 0 : 1;
  }, [selectedTab]);

  const handlePageChanged = useCallback(
    (index: number) => {
      // Convert display name to enum value
      const tabValue = index === 0 ? 'watchlist' : 'trending';

      // Primary state update - this is the source of truth
      setSelectedTab(tabValue);
      onTabChange(tabValue);

      // Secondary update - sync SharedValue for TabBar component
      // Note: This will be automatically updated by useEffect above, but we do it immediately for responsive UI
      focusedTab.value = tabNames[index];
    },
    [focusedTab, onTabChange, setSelectedTab, tabNames],
  );

  const handleTabChange = useDebouncedCallback((tabName: string) => {
    handlePageChanged(tabNames.indexOf(tabName));
    carouselRef.current?.scrollTo({ index: tabNames.indexOf(tabName) });
  }, 50);

  return {
    tabNames,
    watchlistTabName,
    trendingTabName,
    focusedTab,
    carouselRef,
    handlePageChanged,
    handleTabChange,
    defaultIndex,
    selectedTab,
  };
}
