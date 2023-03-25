import { useLayoutEffect } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useWindowDimensions } from 'react-native';
import { SceneMap, TabView } from 'react-native-tab-view';

import {
  Box,
  useIsVerticalLayout,
  useSafeAreaInsets,
} from '@onekeyhq/components';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { MARKET_TAB_NAME, SWAP_TAB_NAME } from '../../store/reducers/market';
import Swap from '../Swap';

import MarketHeader from './Components/MarketList/MarketTopHeader';
import { useMarketTopTabName } from './hooks/useMarketList';
import MarketList from './MarketList';

import type { MarketTopTabName } from '../../store/reducers/market';

const renderScene = SceneMap({
  [SWAP_TAB_NAME]: Swap,
  [MARKET_TAB_NAME]: MarketList,
});

const routes: { key: MarketTopTabName }[] = [
  { key: SWAP_TAB_NAME },
  { key: MARKET_TAB_NAME },
];
const setIndex = (index: number) => {
  backgroundApiProxy.serviceMarket.switchMarketTopTab(routes[index].key);
};
const renderTabBar = () => <MarketHeader />;
const Market = () => {
  const navigation = useNavigation();
  const { top } = useSafeAreaInsets();
  const marketTopTabName = useMarketTopTabName();
  const isVerticalLayout = useIsVerticalLayout();
  const layout = useWindowDimensions();

  const index = routes.findIndex((route) => route.key === marketTopTabName);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
    if (!isVerticalLayout && marketTopTabName !== MARKET_TAB_NAME) {
      backgroundApiProxy.serviceMarket.switchMarketTopTab(MARKET_TAB_NAME);
    }
  }, [isVerticalLayout, marketTopTabName, navigation]);

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
};

export default Market;
