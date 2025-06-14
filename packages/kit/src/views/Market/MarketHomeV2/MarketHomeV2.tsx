import { useEffect, useState } from 'react';

import { Animated, Easing } from 'react-native';

import { Page, useMedia } from '@onekeyhq/components';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import { TabPageHeader } from '../../../components/TabPageHeader';
import { ProviderJotaiContextMarketV2 } from '../../../states/jotai/contexts/marketV2';
import useHomePageWidth from '../../Home/hooks/useHomePageWidth';

import { MarketFilterBar } from './components/MarketFilterBar';
import { MarketFilterBarSmall } from './components/MarketFilterBarSmall';
import { MarketTokenList } from './components/MarketTokenList';

import type { ITimeRangeSelectorValue } from './components/TimeRangeSelector';
import type { ILiquidityFilter } from './types';

let CONTENT_ITEM_WIDTH: Animated.Value | undefined;

function MarketHome() {
  const { pageWidth } = useHomePageWidth();
  const { md } = useMedia();
  const [selectedNetworkId, setSelectedNetworkId] =
    useState<string>('sol--101'); // 默认选择 Solana
  const [liquidityFilter, setLiquidityFilter] = useState<ILiquidityFilter>({});
  const [timeRange, setTimeRange] = useState<ITimeRangeSelectorValue>('5m');

  if (CONTENT_ITEM_WIDTH == null) {
    CONTENT_ITEM_WIDTH = new Animated.Value(pageWidth);
  }
  useEffect(() => {
    if (!CONTENT_ITEM_WIDTH) {
      return;
    }
    Animated.timing(CONTENT_ITEM_WIDTH, {
      toValue: pageWidth,
      duration: 400,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [pageWidth]);

  const filterBarProps = {
    selectedNetworkId,
    timeRange,
    liquidityFilter,
    onNetworkIdChange: setSelectedNetworkId,
    onTimeRangeChange: setTimeRange,
    onLiquidityFilterChange: setLiquidityFilter,
  };

  return (
    <Page>
      <TabPageHeader
        sceneName={EAccountSelectorSceneName.home}
        tabRoute={ETabRoutes.Market}
      />
      <Page.Body>
        {md ? (
          <MarketFilterBarSmall {...filterBarProps} />
        ) : (
          <MarketFilterBar {...filterBarProps} />
        )}

        <MarketTokenList
          networkId={selectedNetworkId}
          liquidityFilter={liquidityFilter}
        />
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
