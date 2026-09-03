import { useCallback, useMemo, useRef } from 'react';

import { useIntl } from 'react-intl';

import { usePerpTabConfig } from '@onekeyhq/kit/src/hooks/usePerpTabConfig';
import { useMarketSelectedTabAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { getIsMarketTabSelectionInFlight } from '../marketTabSelectionGuards';

import type { IMarketCategoryItem, IMarketHomeTabValue } from '../../types';
import type { IMarketTabWrittenSelection } from '../marketTabSelectionGuards';

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
  /**
   * Whether a locally-initiated tab selection is still round-tripping
   * through the bg-synced atom. While true, `selectedTab`/`selectedTabName`
   * may be stale and must not drive programmatic pager jumps.
   */
  isTabSelectionInFlight: () => boolean;
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
  const [marketSelectedTab, setSelectedTabAtom] = useMarketSelectedTabAtom();
  const { tab: selectedTab } = marketSelectedTab;
  const { perpDisabled } = usePerpTabConfig();

  // Latest selection written to the bg-synced atom. On runtimes that proxy
  // UI atom writes to bg, the UI mirror only updates after the bg round-trip
  // echoes the value back, so the mirror stays stale until then.
  const lastWrittenSelectionRef = useRef<
    IMarketTabWrittenSelection | undefined
  >(undefined);
  const marketSelectedTabRef = useRef(marketSelectedTab);
  marketSelectedTabRef.current = marketSelectedTab;

  const isTabSelectionInFlight = useCallback(() => {
    const inFlight = getIsMarketTabSelectionInFlight({
      lastWrittenSelection: lastWrittenSelectionRef.current,
      atomTab: marketSelectedTabRef.current.tab,
      atomSpotCategoryId: marketSelectedTabRef.current.selectedSpotCategory,
    });
    if (!inFlight) {
      lastWrittenSelectionRef.current = undefined;
    }
    return inFlight;
  }, []);
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

      lastWrittenSelectionRef.current = { tab: tabValue, categoryId };
      setSelectedTabAtom((prev) => ({
        ...prev,
        tab: tabValue,
        selectedSpotCategory: categoryId ?? prev.selectedSpotCategory,
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
    isTabSelectionInFlight,
  };
}
