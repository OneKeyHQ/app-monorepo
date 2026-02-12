import { useMemo } from 'react';

import { useIntl } from 'react-intl';
import { useDebouncedCallback } from 'use-debounce';

import { usePerpTabConfig } from '@onekeyhq/kit/src/hooks/usePerpTabConfig';
import { useMarketSelectedTabAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import type { IMarketHomeTabValue } from '../../types';

export interface IMarketTabsLogicReturn {
  watchlistTabName: string;
  spotTabName: string;
  perpsTabName: string;
  showPerpsTab: boolean;
  handleTabChange: (tabName: string) => void;
  selectedTab: string;
}

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
  const spotTabName = intl.formatMessage({
    id: ETranslations.dexmarket_spot,
  });
  const perpsTabName = intl.formatMessage({
    id: ETranslations.global_perp,
  });

  const nameToValueMap = useMemo(
    () =>
      ({
        [watchlistTabName]: 'watchlist',
        [spotTabName]: 'trending',
        [perpsTabName]: 'perps',
      }) as Record<string, IMarketHomeTabValue>,
    [watchlistTabName, spotTabName, perpsTabName],
  );

  const handleTabChange = useDebouncedCallback((tabName: string) => {
    const tabValue = nameToValueMap[tabName] ?? 'trending';
    setSelectedTabAtom({ tab: tabValue });
    onTabChange(tabValue);
  }, 50);

  return {
    watchlistTabName,
    spotTabName,
    perpsTabName,
    showPerpsTab,
    handleTabChange,
    selectedTab,
  };
}
