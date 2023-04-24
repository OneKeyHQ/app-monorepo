import { useCallback, useMemo } from 'react';

import { useFocusEffect } from '@react-navigation/core';

import { Box, useSafeAreaInsets } from '@onekeyhq/components';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { TabRoutes } from '../../routes/routesEnum';
import Swap from '../Swap';

import MarketHeader from './Components/MarketList/MarketTopHeader';
import MarketList from './MarketList';

import type { MarketTopTabName } from '../../store/reducers/market';

export function ScreenMarketOrSwap({
  marketTopTabName,
}: {
  marketTopTabName: MarketTopTabName;
}) {
  const { top } = useSafeAreaInsets();

  useFocusEffect(
    useCallback(() => {
      backgroundApiProxy.serviceMarket.switchMarketTopTab(marketTopTabName);
    }, [marketTopTabName]),
  );

  const contentComponent = useMemo(() => {
    switch (marketTopTabName) {
      case TabRoutes.Market:
        return <MarketList />;
      case TabRoutes.Swap:
        return <Swap hideBottomTabBar />;
      default:
    }
  }, [marketTopTabName]);

  return (
    <Box flex={1} mt={`${top}px`}>
      <MarketHeader marketTopTabName={marketTopTabName} />
      {contentComponent}
    </Box>
  );
}
