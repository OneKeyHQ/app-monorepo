import { useCallback, useMemo } from 'react';

import { useFocusEffect } from '@react-navigation/core';
import { useWindowDimensions } from 'react-native';
import { SceneMap, TabView } from 'react-native-tab-view';

import {
  Box,
  useIsVerticalLayout,
  useSafeAreaInsets,
} from '@onekeyhq/components';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { TabRoutes } from '../../routes/routesEnum';
import Swap from '../Swap';

import MarketHeader from './Components/MarketList/MarketTopHeader';
import MarketList from './MarketList';

import type { MarketTopTabName } from '../../store/reducers/market';

const SwapWithoutBottomTabBar = () => <Swap hideBottomTabBar />;
const renderScene = SceneMap({
  [TabRoutes.Swap]: SwapWithoutBottomTabBar,
  [TabRoutes.Market]: MarketList,
});

const routes: { key: MarketTopTabName }[] = [
  { key: TabRoutes.Swap },
  { key: TabRoutes.Market },
];
const setIndex = (index: number) => {
  backgroundApiProxy.serviceMarket.switchMarketTopTab(routes[index].key);
};

export function ScreenMarketOrSwap({
  marketTopTabName,
}: {
  marketTopTabName: MarketTopTabName;
}) {
  const { top } = useSafeAreaInsets();

  const isVerticalLayout = useIsVerticalLayout();
  const layout = useWindowDimensions();
  const index = routes.findIndex((route) => route.key === marketTopTabName);
  useFocusEffect(
    useCallback(() => {
      backgroundApiProxy.serviceMarket.switchMarketTopTab(marketTopTabName);
    }, [marketTopTabName]),
  );

  const renderTabBar = useCallback(
    () => <MarketHeader marketTopTabName={marketTopTabName} />,
    [marketTopTabName],
  );
  return (
    <Box flex={1} mt={`${top}px`}>
      <TabView
        lazy={!isVerticalLayout}
        swipeEnabled={isVerticalLayout}
        renderTabBar={renderTabBar}
        navigationState={{ index, routes }}
        renderScene={renderScene}
        onIndexChange={setIndex}
        initialLayout={{ width: layout.width }}
      />
    </Box>
  );
}
