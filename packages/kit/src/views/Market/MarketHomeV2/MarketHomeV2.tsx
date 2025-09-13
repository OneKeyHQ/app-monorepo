import { useEffect, useMemo, useRef, useState } from 'react';

import { Page, useMedia } from '@onekeyhq/components';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EDexListName } from '@onekeyhq/shared/src/logger/scopes/dex';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import { TabPageHeader } from '../../../components/TabPageHeader';
import { useSelectedNetworkIdAtom } from '../../../states/jotai/contexts/marketV2';
import { useMarketBasicConfig, useMarketEnterAnalytics } from '../hooks';
import { MarketWatchListProviderMirrorV2 } from '../MarketWatchListProviderMirrorV2';

import { DesktopLayout } from './layouts/DesktopLayout';
import { MobileLayout } from './layouts/MobileLayout';

import type { ITimeRangeSelectorValue } from './components/TimeRangeSelector';
import type { ILiquidityFilter, IMarketHomeTabValue } from './types';

function MarketHome() {
  const { md } = useMedia();

  // Load market basic config using the new hook
  const { defaultNetworkId, formattedMinLiquidity } = useMarketBasicConfig();
  const [selectedNetworkId, setSelectedNetworkId] = useSelectedNetworkIdAtom();

  // Track market entry analytics
  useMarketEnterAnalytics();

  // Track if this is the first tab change (automatic) to skip analytics
  const isFirstTabChange = useRef(true);
  // Track previous tab to prevent duplicate analytics events
  const prevTabId = useRef<IMarketHomeTabValue | null>(null);

  // Update selectedNetworkId when config loads and it's still the default
  useEffect(() => {
    if (defaultNetworkId && selectedNetworkId === 'sol--101') {
      setSelectedNetworkId(defaultNetworkId);
    }
  }, [defaultNetworkId, selectedNetworkId, setSelectedNetworkId]);

  const [liquidityFilter, setLiquidityFilter] = useState<ILiquidityFilter>({
    min: '5K',
  });

  // Update liquidityFilter when config loads
  useEffect(() => {
    if (formattedMinLiquidity && liquidityFilter.min === '5K') {
      setLiquidityFilter({ min: formattedMinLiquidity });
    }
  }, [formattedMinLiquidity, liquidityFilter.min]);
  const [timeRange, setTimeRange] = useState<ITimeRangeSelectorValue>('5m');

  const handleTabChange = (tabId: IMarketHomeTabValue) => {
    // Skip analytics for the first automatic tab change
    if (isFirstTabChange.current) {
      isFirstTabChange.current = false;
      prevTabId.current = tabId;
      return;
    }

    // Skip analytics if tab hasn't actually changed (prevent duplicate events)
    if (prevTabId.current === tabId) {
      return;
    }

    // Update previous tab id
    prevTabId.current = tabId;

    // Track dex list selection only when user clicks tab (not default selection)
    // Convert tab value to dex list name
    const dexListName =
      tabId === 'trending' ? EDexListName.Trending : EDexListName.Watchlist;

    defaultLogger.dex.list.dexList({
      dexListName,
    });
  };

  const mobileProps = useMemo(
    () => ({
      filterBarProps: {
        selectedNetworkId,
        timeRange,
        liquidityFilter,
        onNetworkIdChange: setSelectedNetworkId,
        onTimeRangeChange: setTimeRange,
        onLiquidityFilterChange: setLiquidityFilter,
      },
      selectedNetworkId,
      liquidityFilter,
      onTabChange: handleTabChange,
    }),
    [selectedNetworkId, timeRange, liquidityFilter, setSelectedNetworkId],
  );

  const desktopProps = useMemo(
    () => ({
      filterBarProps: {
        selectedNetworkId,
        timeRange,
        liquidityFilter,
        onNetworkIdChange: setSelectedNetworkId,
        onTimeRangeChange: setTimeRange,
        onLiquidityFilterChange: setLiquidityFilter,
      },
      selectedNetworkId,
      liquidityFilter,
      onTabChange: handleTabChange,
    }),
    [selectedNetworkId, timeRange, liquidityFilter, setSelectedNetworkId],
  );

  return (
    <Page>
      <TabPageHeader
        sceneName={EAccountSelectorSceneName.home}
        tabRoute={ETabRoutes.Market}
      />
      <Page.Body>
        {md ? (
          <MobileLayout {...mobileProps} />
        ) : (
          <DesktopLayout {...desktopProps} />
        )}
      </Page.Body>
    </Page>
  );
}

export function MarketHomeV2() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <MarketWatchListProviderMirrorV2
        storeName={EJotaiContextStoreNames.marketWatchListV2}
      >
        <MarketHome />
      </MarketWatchListProviderMirrorV2>
    </AccountSelectorProviderMirror>
  );
}
