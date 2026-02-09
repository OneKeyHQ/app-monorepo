import { useCallback, useEffect, useMemo, useRef } from 'react';

import { useIntl } from 'react-intl';
import { useSharedValue } from 'react-native-reanimated';
import { useDebouncedCallback } from 'use-debounce';

import type { ICarouselInstance } from '@onekeyhq/components';
import { useMarketSelectedTabAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
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
  const [{ tab: selectedTab }, setSelectedTabAtom] = useMarketSelectedTabAtom();

  const watchlistTabName = intl.formatMessage({
    id: ETranslations.global_favorites,
  });
  const trendingTabName = intl.formatMessage({
    id: ETranslations.market_trending,
  });

  const carouselRef = useRef<ICarouselInstance>(null);
  // Track whether the current update is from internal tab/page change
  const isInternalUpdateRef = useRef(false);

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

  // Update focusedTab when selectedTab changes
  focusedTab.value = initialTabName;

  const defaultIndex = useMemo(() => {
    return selectedTab === 'watchlist' ? 0 : 1;
  }, [selectedTab]);

  // Sync Carousel page when selectedTab changes from external navigation
  // (e.g., navigating from Wallet page to Market watchlist tab)
  useEffect(() => {
    // Skip if this is an internal update (from handlePageChanged or handleTabChange)
    if (isInternalUpdateRef.current) {
      isInternalUpdateRef.current = false;
      return;
    }

    const targetIndex = selectedTab === 'watchlist' ? 0 : 1;
    const currentIndex = carouselRef.current?.getCurrentIndex();

    // Only scroll if Carousel is mounted and index differs
    if (currentIndex !== undefined && currentIndex !== targetIndex) {
      carouselRef.current?.scrollTo({ index: targetIndex });
    }
  }, [selectedTab]);

  const handlePageChanged = useCallback(
    (index: number) => {
      // Convert display name to enum value
      const tabValue = index === 0 ? 'watchlist' : 'trending';

      // Mark as internal update to prevent useEffect from re-triggering scroll
      isInternalUpdateRef.current = true;

      // Reset after a short delay to handle cases where atom value doesn't change
      // (e.g., clicking the already-active tab), so future external navigation works.
      // Using setTimeout ensures this runs after React's useEffect (which uses MessageChannel).
      setTimeout(() => {
        isInternalUpdateRef.current = false;
      }, 100);

      // Primary state update - this is the source of truth
      setSelectedTabAtom({ tab: tabValue });
      onTabChange(tabValue);

      // Secondary update - sync SharedValue for TabBar component
      focusedTab.value = tabNames[index];
    },
    [focusedTab, onTabChange, setSelectedTabAtom, tabNames],
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
