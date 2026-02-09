import { useCallback, useMemo, useRef } from 'react';

import { useIntl } from 'react-intl';
import { useSharedValue } from 'react-native-reanimated';
import { useDebouncedCallback } from 'use-debounce';

import type { ICarouselInstance } from '@onekeyhq/components';
import { usePerpTabConfig } from '@onekeyhq/kit/src/hooks/usePerpTabConfig';
import { useMarketSelectedTabAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import type { IMarketHomeTabValue } from '../../types';
import type { SharedValue } from 'react-native-reanimated';

export interface IMarketTabsLogicReturn {
  // Tab related data
  tabNames: string[];
  watchlistTabName: string;
  spotTabName: string;
  perpsTabName: string;
  showPerpsTab: boolean;

  // Tab control
  focusedTab: SharedValue<string>;
  carouselRef: React.RefObject<ICarouselInstance | null>;
  handleTabChange: (tabName: string) => void;
  handlePageChanged: (index: number) => void;
  defaultIndex: number;

  // State
  selectedTab: string;
}

const TAB_VALUES: IMarketHomeTabValue[] = ['watchlist', 'trending', 'perps'];
const TAB_VALUES_NO_PERPS: IMarketHomeTabValue[] = ['watchlist', 'trending'];

export function useMarketTabsLogic(
  onTabChange: (tabId: IMarketHomeTabValue) => void,
): IMarketTabsLogicReturn {
  const intl = useIntl();
  const [{ tab: selectedTab }, setSelectedTabAtom] = useMarketSelectedTabAtom();
  const { perpDisabled } = usePerpTabConfig();
  const showPerpsTab = !perpDisabled;

  const watchlistTabName = intl.formatMessage({
    id: ETranslations.global_favorites,
  });
  // TODO: Add proper i18n key for "Spot" (现货) once available
  const spotTabName = 'Spot';
  const perpsTabName = intl.formatMessage({
    id: ETranslations.global_contract,
  });

  const carouselRef = useRef<ICarouselInstance>(null);
  const tabNames = useMemo(() => {
    const names = [watchlistTabName, spotTabName];
    if (showPerpsTab) {
      names.push(perpsTabName);
    }
    return names;
  }, [watchlistTabName, spotTabName, perpsTabName, showPerpsTab]);

  const tabValues = showPerpsTab ? TAB_VALUES : TAB_VALUES_NO_PERPS;

  // Use the selected tab from global state, default to trending if not set
  const initialTabName = useMemo(() => {
    if (selectedTab === 'watchlist') return watchlistTabName;
    if (selectedTab === 'perps' && showPerpsTab) return perpsTabName;
    return spotTabName;
  }, [selectedTab, watchlistTabName, spotTabName, perpsTabName, showPerpsTab]);

  // Create a SharedValue that always syncs with the atom state
  const focusedTab = useSharedValue(initialTabName);

  // Update focusedTab when selectedTab changes
  focusedTab.value = initialTabName;

  const defaultIndex = useMemo(() => {
    if (selectedTab === 'watchlist') return 0;
    if (selectedTab === 'perps' && showPerpsTab) return 2;
    return 1;
  }, [selectedTab, showPerpsTab]);

  const handlePageChanged = useCallback(
    (index: number) => {
      const tabValue = tabValues[index] ?? 'trending';

      // Primary state update - this is the source of truth
      setSelectedTabAtom({ tab: tabValue });
      onTabChange(tabValue);

      // Secondary update - sync SharedValue for TabBar component
      focusedTab.value = tabNames[index];
    },
    [focusedTab, onTabChange, setSelectedTabAtom, tabNames, tabValues],
  );

  const handleTabChange = useDebouncedCallback((tabName: string) => {
    handlePageChanged(tabNames.indexOf(tabName));
    carouselRef.current?.scrollTo({ index: tabNames.indexOf(tabName) });
  }, 50);

  return {
    tabNames,
    watchlistTabName,
    spotTabName,
    perpsTabName,
    showPerpsTab,
    focusedTab,
    carouselRef,
    handlePageChanged,
    handleTabChange,
    defaultIndex,
    selectedTab,
  };
}
