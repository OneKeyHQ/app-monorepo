import { useMemo, useState } from 'react';

import { Page, useMedia } from '@onekeyhq/components';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import { TabPageHeader } from '../../../components/TabPageHeader';
import { MarketWatchListProviderMirrorV2 } from '../MarketWatchListProviderMirrorV2';

import { DesktopLayout } from './layouts/DesktopLayout';
import { MobileLayout } from './layouts/MobileLayout';
import { EMarketHomeTab } from './types';

import type { ITimeRangeSelectorValue } from './components/TimeRangeSelector';
import type { ILiquidityFilter, IMarketHomeTabValue } from './types';

function MarketHome() {
  const { md } = useMedia();

  const [selectedNetworkId, setSelectedNetworkId] =
    useState<string>('sol--101');
  const [liquidityFilter, setLiquidityFilter] = useState<ILiquidityFilter>({
    min: '5K',
  });
  const [timeRange, setTimeRange] = useState<ITimeRangeSelectorValue>('5m');

  const [activeTab, setActiveTab] = useState<IMarketHomeTabValue>(
    EMarketHomeTab.Trending,
  );

  const commonProps = useMemo(
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
      activeTab,
      onTabChange: setActiveTab,
    }),
    [selectedNetworkId, timeRange, liquidityFilter, activeTab],
  );

  return (
    <Page>
      <TabPageHeader
        sceneName={EAccountSelectorSceneName.home}
        tabRoute={ETabRoutes.Market}
      />
      <Page.Body>
        {md ? (
          <MobileLayout {...commonProps} />
        ) : (
          <DesktopLayout {...commonProps} />
        )}
      </Page.Body>
    </Page>
  );
}

export function MarketHomeV2() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.market,
        sceneUrl: ETabRoutes.Market,
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
