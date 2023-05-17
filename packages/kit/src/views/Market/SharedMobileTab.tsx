import { memo, useCallback, useMemo, useRef, useState } from 'react';

import { useWindowDimensions } from 'react-native';
import { SceneMap, TabView } from 'react-native-tab-view';

import { enableOnPressAnim } from '@onekeyhq/components/src/utils/useBeforeOnPress';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { TabRoutes } from '../../routes/routesEnum';
import Swap from '../Swap';

import MarketHeader from './Components/MarketList/MarketTopHeader';
import {
  marketSwapTabRoutes,
  setMarketSwapTabName,
} from './hooks/useMarketList';
import MarketList from './MarketList';
import { SharedMobileTabContext } from './SharedMobileTabContext';

import type { MarketTopTabName } from '../../store/reducers/market';

const SwapWithoutBottomTabBar = () => <Swap hideBottomTabBar />;
const renderScene = SceneMap({
  [TabRoutes.Swap]: SwapWithoutBottomTabBar,
  [TabRoutes.Market]: MarketList,
});

const SharedMobileTab = ({ routeName }: { routeName: MarketTopTabName }) => {
  const targetTabName = useRef(routeName);
  const [swipeEnabled, setSwipeEnabled] = useState(platformEnv.isNative);

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

  const onSwipeStart = useCallback(() => {
    enableOnPressAnim.value = 0;
  }, []);

  const onSwipeEnd = useCallback(() => {
    if (platformEnv.isNativeAndroid) {
      setMarketSwapTabName(targetTabName.current);
    }
    setTimeout(() => {
      enableOnPressAnim.value = 1;
    }, 100);
  }, []);

  const intialLayout = useMemo(() => ({ width: layout.width }), [layout.width]);

  return (
    <SharedMobileTabContext.Provider value={setSwipeEnabled}>
      <TabView
        renderTabBar={renderTabBar}
        navigationState={navigationState}
        renderScene={renderScene}
        onIndexChange={setTargetIndex}
        onSwipeStart={onSwipeStart}
        onSwipeEnd={onSwipeEnd}
        swipeEnabled={swipeEnabled}
        initialLayout={intialLayout}
        // disable to avoid navigate animation
        animationEnabled={false}
      />
    </SharedMobileTabContext.Provider>
  );
};

export default memo(SharedMobileTab);
