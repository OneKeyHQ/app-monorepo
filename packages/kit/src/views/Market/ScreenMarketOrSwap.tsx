import { useCallback } from 'react';

import { useWindowDimensions } from 'react-native';
import { SceneMap, TabView } from 'react-native-tab-view';

import {
  Box,
  useIsVerticalLayout,
  useSafeAreaInsets,
} from '@onekeyhq/components';

import { TabRoutes } from '../../routes/routesEnum';
import Swap from '../Swap';

import MarketHeader from './Components/MarketList/MarketTopHeader';
import {
  marketSwapTabRoutes,
  setMarketSwapTabIndex,
  useMarketTopTabName,
} from './hooks/useMarketList';
import MarketList from './MarketList';

import type { MarketTopTabName } from '../../store/reducers/market';

const SwapWithoutBottomTabBar = () => <Swap hideBottomTabBar />;
const renderScene = SceneMap({
  [TabRoutes.Swap]: SwapWithoutBottomTabBar,
  [TabRoutes.Market]: MarketList,
});

export function ScreenMarketOrSwap({
  desktopTabName,
}: {
  desktopTabName: MarketTopTabName;
}) {
  const { top } = useSafeAreaInsets();
  const mobileTopTabName = useMarketTopTabName();

  const isVerticalLayout = useIsVerticalLayout();
  const marketTabName = isVerticalLayout ? mobileTopTabName : desktopTabName;
  const layout = useWindowDimensions();
  const index = marketSwapTabRoutes.findIndex(
    (route) => route.key === marketTabName,
  );
  // useFocusEffect(
  //   useCallback(() => {
  //     backgroundApiProxy.serviceMarket.switchMarketTopTab(marketTopTabName);
  //   }, [marketTopTabName]),
  // );

  const renderTabBar = useCallback(
    () => <MarketHeader marketTopTabName={marketTabName} />,
    [marketTabName],
  );
  return (
    <Box flex={1} mt={`${top}px`}>
      <TabView
        lazy={!isVerticalLayout}
        swipeEnabled={isVerticalLayout}
        renderTabBar={renderTabBar}
        navigationState={{ index, routes: marketSwapTabRoutes }}
        renderScene={renderScene}
        onIndexChange={setMarketSwapTabIndex}
        initialLayout={{ width: layout.width }}
      />
    </Box>
  );
}
