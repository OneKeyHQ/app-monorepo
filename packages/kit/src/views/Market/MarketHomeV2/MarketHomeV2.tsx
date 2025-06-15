import { useState } from 'react';

import { Page, useMedia } from '@onekeyhq/components';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import { TabPageHeader } from '../../../components/TabPageHeader';
import { ProviderJotaiContextMarketV2 } from '../../../states/jotai/contexts/marketV2';

import { MarketHomeContent } from './components/MarketHomeContent';
import { MarketHomeContentMobile } from './components/MarketHomeContentMobile';

import type { ITimeRangeSelectorValue } from './components/TimeRangeSelector';
import type { ILiquidityFilter } from './types';

function MarketHome() {
  const { md } = useMedia();

  const [selectedNetworkId, setSelectedNetworkId] =
    useState<string>('sol--101'); // 默认选择 Solana
  const [liquidityFilter, setLiquidityFilter] = useState<ILiquidityFilter>({});
  const [timeRange, setTimeRange] = useState<ITimeRangeSelectorValue>('5m');

  const filterBarProps = {
    selectedNetworkId,
    timeRange,
    liquidityFilter,
    onNetworkIdChange: setSelectedNetworkId,
    onTimeRangeChange: setTimeRange,
    onLiquidityFilterChange: setLiquidityFilter,
  };

  const commonProps = {
    filterBarProps,
    selectedNetworkId,
    liquidityFilter,
  };

  return (
    <Page>
      <TabPageHeader
        sceneName={EAccountSelectorSceneName.home}
        tabRoute={ETabRoutes.Market}
      />
      <Page.Body>
        {md ? (
          <MarketHomeContentMobile {...commonProps} />
        ) : (
          <MarketHomeContent {...commonProps} />
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
      <ProviderJotaiContextMarketV2>
        <MarketHome />
      </ProviderJotaiContextMarketV2>
    </AccountSelectorProviderMirror>
  );
}
