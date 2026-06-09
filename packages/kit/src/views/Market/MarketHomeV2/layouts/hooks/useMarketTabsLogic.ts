import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { usePerpTabConfig } from '@onekeyhq/kit/src/hooks/usePerpTabConfig';
import { useMarketSelectedTabAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import type { IMarketCategoryItem, IMarketHomeTabValue } from '../../types';

export interface IMarketSpotTabItem {
  categoryId: string;
  tabName: string;
}

export interface IMarketTabsLogicReturn {
  watchlistTabName: string;
  spotTabItems: IMarketSpotTabItem[];
  perpsTabName: string;
  showPerpsTab: boolean;
  handleTabChange: (tabName: string) => void;
  isSpotTabName: (tabName: string) => boolean;
  getSpotCategoryIdByTabName: (tabName: string) => string | undefined;
  selectedTab: string;
  selectedTabName: string;
}

interface IUseMarketTabsLogicOptions {
  spotCategories?: IMarketCategoryItem[];
  selectedSpotCategory?: string;
  onSpotCategoryChange?: (categoryId: string) => void;
}

export function useMarketTabsLogic(
  onTabChange: (tabId: IMarketHomeTabValue) => void,
  options?: IUseMarketTabsLogicOptions,
): IMarketTabsLogicReturn {
  const intl = useIntl();
  const [{ tab: selectedTab }, setSelectedTabAtom] = useMarketSelectedTabAtom();
  const { perpDisabled } = usePerpTabConfig();
  const showPerpsTab = !perpDisabled;
  const { spotCategories, selectedSpotCategory, onSpotCategoryChange } =
    options ?? {};

  const watchlistTabName = intl.formatMessage({
    id: ETranslations.global_favorites,
  });
  const spotTabName = intl.formatMessage({
    id: ETranslations.dexmarket_spot,
  });
  const perpsTabName = intl.formatMessage({
    id: ETranslations.global_perp,
  });

  const spotTabItems = useMemo<IMarketSpotTabItem[]>(() => {
    const categories = spotCategories?.length
      ? spotCategories
      : [{ id: 'trending', name: spotTabName }];

    return categories.map((category) => ({
      categoryId: category.id,
      tabName: category.name || category.id,
    }));
  }, [spotCategories, spotTabName]);

  const spotTabNameToCategoryIdMap = useMemo(
    () =>
      spotTabItems.reduce<Record<string, string>>((acc, item) => {
        acc[item.tabName] = item.categoryId;
        return acc;
      }, {}),
    [spotTabItems],
  );

  const selectedSpotTabName = useMemo(() => {
    const selectedSpotTab = spotTabItems.find(
      (item) => item.categoryId === selectedSpotCategory,
    );
    return selectedSpotTab?.tabName ?? spotTabItems[0]?.tabName ?? spotTabName;
  }, [selectedSpotCategory, spotTabItems, spotTabName]);

  const isSpotTabName = useCallback(
    (tabName: string) => !!spotTabNameToCategoryIdMap[tabName],
    [spotTabNameToCategoryIdMap],
  );

  const getSpotCategoryIdByTabName = useCallback(
    (tabName: string) => spotTabNameToCategoryIdMap[tabName],
    [spotTabNameToCategoryIdMap],
  );

  const handleTabChange = useCallback(
    (tabName: string) => {
      let tabValue: IMarketHomeTabValue = 'trending';
      const categoryId = spotTabNameToCategoryIdMap[tabName];

      if (tabName === watchlistTabName) {
        tabValue = 'watchlist';
      } else if (tabName === perpsTabName) {
        tabValue = 'perps';
      }

      const isSelectionUnchanged =
        tabValue === selectedTab &&
        (!categoryId || categoryId === selectedSpotCategory);

      if (isSelectionUnchanged) {
        return;
      }

      if (categoryId) {
        onSpotCategoryChange?.(categoryId);
      }

      setSelectedTabAtom((prev) => ({
        ...prev,
        tab: tabValue,
        spotCategoryToSelect: undefined,
      }));
      onTabChange(tabValue);
    },
    [
      onSpotCategoryChange,
      onTabChange,
      perpsTabName,
      selectedSpotCategory,
      selectedTab,
      setSelectedTabAtom,
      spotTabNameToCategoryIdMap,
      watchlistTabName,
    ],
  );

  const selectedTabName = useMemo(() => {
    if (selectedTab === 'watchlist') return watchlistTabName;
    if (selectedTab === 'perps' && showPerpsTab) return perpsTabName;
    return selectedSpotTabName;
  }, [
    selectedTab,
    watchlistTabName,
    selectedSpotTabName,
    perpsTabName,
    showPerpsTab,
  ]);

  return {
    watchlistTabName,
    spotTabItems,
    perpsTabName,
    showPerpsTab,
    handleTabChange,
    isSpotTabName,
    getSpotCategoryIdByTabName,
    selectedTab,
    selectedTabName,
  };
}
