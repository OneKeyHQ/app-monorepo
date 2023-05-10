import { useCallback, useMemo, useRef } from 'react';

import { useWindowDimensions } from 'react-native';
import { SceneMap, TabView } from 'react-native-tab-view';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { TabRoutes } from '../../routes/routesEnum';
import Swap from '../Swap';

import MarketHeader from './Components/MarketList/MarketTopHeader';
import {
  marketSwapTabRoutes,
  setMarketSwapTabName,
} from './hooks/useMarketList';
import MarketList from './MarketList';

import type { MarketTopTabName } from '../../store/reducers/market';

const SwapWithoutBottomTabBar = () => <Swap hideBottomTabBar />;
const renderScene = SceneMap({
  [TabRoutes.Swap]: SwapWithoutBottomTabBar,
  [TabRoutes.Market]: MarketList,
});

export function SharedMobileTab({
  routeName,
}: {
  routeName: MarketTopTabName;
}) {
  const targetTabName = useRef(routeName);

  const layout = useWindowDimensions();

  const renderTabBar = useCallback(
    () => <MarketHeader marketTopTabName={routeName} />,
    [routeName],
  );

  const navigationState = useMemo(
    () => ({
      index: marketSwapTabRoutes.findIndex((route) => route.key === routeName),
      routes: marketSwapTabRoutes,
    }),
    [routeName],
  );

  const setTargetIndex = useCallback((index: number) => {
    targetTabName.current = marketSwapTabRoutes[index].key;
    if (platformEnv.isNativeIOS) {
      setTimeout(() => setMarketSwapTabName(targetTabName.current));
    }
  }, []);

  const onSwipeEnd = useCallback(() => {
    if (platformEnv.isNativeAndroid) {
      setMarketSwapTabName(targetTabName.current);
    }
  }, []);

  const intialLayout = useMemo(() => ({ width: layout.width }), [layout.width]);

  return (
    <TabView
      renderTabBar={renderTabBar}
      navigationState={navigationState}
      renderScene={renderScene}
      onIndexChange={setTargetIndex}
      onSwipeEnd={onSwipeEnd}
      swipeEnabled={platformEnv.isNative}
      initialLayout={intialLayout}
      // disable to avoid navigate animation
      animationEnabled={false}
    />
  );
}
