import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

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
  selectedTabName: string;
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

  const handleTabChange = useCallback(
    (tabName: string) => {
      const tabValue = nameToValueMap[tabName] ?? 'trending';
      setSelectedTabAtom({ tab: tabValue });
      onTabChange(tabValue);
    },
    [nameToValueMap, onTabChange, setSelectedTabAtom],
  );

  const selectedTabName = useMemo(() => {
    if (selectedTab === 'watchlist') return watchlistTabName;
    if (selectedTab === 'perps' && showPerpsTab) return perpsTabName;
    return spotTabName;
  }, [selectedTab, watchlistTabName, spotTabName, perpsTabName, showPerpsTab]);

  return {
    watchlistTabName,
    spotTabName,
    perpsTabName,
    showPerpsTab,
    handleTabChange,
    selectedTab,
    selectedTabName,
  };
}
