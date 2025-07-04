import { useMemo, useState } from 'react';

import { Page, useMedia } from '@onekeyhq/components';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import { TabPageHeader } from '../../../components/TabPageHeader';
import { ProviderJotaiContextMarketV2 } from '../../../states/jotai/contexts/marketV2';

import { DesktopLayout } from './layouts/DesktopLayout';
import { MobileLayout } from './layouts/MobileLayout';
import { EMarketHomeTab } from './types';

import type { ITimeRangeSelectorValue } from './components/TimeRangeSelector';
import type { ILiquidityFilter, IMarketHomeTabValue } from './types';

function MarketHome() {
  const { md } = useMedia();

  const [selectedNetworkId, setSelectedNetworkId] =
    useState<string>('sol--101');
  const [liquidityFilter, setLiquidityFilter] = useState<ILiquidityFilter>({});
  const [timeRange, setTimeRange] = useState<ITimeRangeSelectorValue>('5m');
  const [showWatchlistOnly, setShowWatchlistOnly] = useState(false);

  const [activeTab, setActiveTab] = useState<IMarketHomeTabValue>(
    EMarketHomeTab.Trending,
  );

  const commonProps = useMemo(
    () => ({
      filterBarProps: {
        selectedNetworkId,
        timeRange,
        liquidityFilter,
        showWatchlistOnly,
        onNetworkIdChange: setSelectedNetworkId,
        onTimeRangeChange: setTimeRange,
        onLiquidityFilterChange: setLiquidityFilter,
        onWatchlistToggle: () => setShowWatchlistOnly((prev) => !prev),
      },
      selectedNetworkId,
      liquidityFilter,
      activeTab,
      onTabChange: setActiveTab,
    }),
    [
      selectedNetworkId,
      timeRange,
      liquidityFilter,
      showWatchlistOnly,
      activeTab,
    ],
  );

  return (
    <Page>
      <TabPageHeader
        sceneName={EAccountSelectorSceneName.market}
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
      <ProviderJotaiContextMarketV2>
        <MarketHome />
      </ProviderJotaiContextMarketV2>
    </AccountSelectorProviderMirror>
  );
}
