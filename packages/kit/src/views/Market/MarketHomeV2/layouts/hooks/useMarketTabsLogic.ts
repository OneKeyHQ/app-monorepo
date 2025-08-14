import { useMemo, useRef } from 'react';

import { useIntl } from 'react-intl';
import { useSharedValue } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { useDebouncedCallback } from 'use-debounce';

import type { ICarouselInstance } from '@onekeyhq/components';
import { useSelectedMarketTabAtom } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import type { IMarketHomeTabValue } from '../../types';

export interface IMarketTabsLogicReturn {
  // Tab related data
  tabNames: string[];
  watchlistTabName: string;
  trendingTabName: string;

  // Tab control
  focusedTab: SharedValue<string>;
  carouselRef: React.RefObject<ICarouselInstance | null>;
  handleTabChange: (tabName: string) => void;

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

  const focusedTab = useSharedValue(initialTabName);

  const handleTabChange = useDebouncedCallback((tabName: string) => {
    setSelectedTab(tabName as IMarketHomeTabValue);
    onTabChange(tabName as IMarketHomeTabValue);
    focusedTab.value = tabName;
    carouselRef.current?.scrollTo({ index: tabNames.indexOf(tabName) });
  }, 100);

  return {
    tabNames,
    watchlistTabName,
    trendingTabName,
    focusedTab,
    carouselRef,
    handleTabChange,
    selectedTab,
  };
}
