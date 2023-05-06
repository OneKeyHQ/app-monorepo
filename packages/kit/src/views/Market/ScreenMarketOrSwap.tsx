import { useCallback, useMemo, useRef } from 'react';

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
import {
  setMarketSwapTabName,
  useMobileMarketTopTabName,
} from './hooks/useMarketList';
import MarketList from './MarketList';

import type { MarketTopTabName } from '../../store/reducers/market';

const SwapWithoutBottomTabBar = () => <Swap hideBottomTabBar />;
const renderScene = SceneMap({
  [TabRoutes.Swap]: SwapWithoutBottomTabBar,
  [TabRoutes.Market]: MarketList,
});

const marketSwapTabRoutes: { key: MarketTopTabName }[] = [
  { key: TabRoutes.Swap },
  { key: TabRoutes.Market },
];
export function ScreenMarketOrSwap({
  routeName,
}: {
  routeName: MarketTopTabName;
}) {
  const { top } = useSafeAreaInsets();
  const mobileTopTabName = useMobileMarketTopTabName();

  const isVerticalLayout = useIsVerticalLayout();
  const lastIsVerticalLayout = useRef(isVerticalLayout);
  const marketTabName = isVerticalLayout ? mobileTopTabName : routeName;

  useFocusEffect(
    useCallback(() => {
      // reset when orientation change
      if (
        !lastIsVerticalLayout.current &&
        isVerticalLayout &&
        mobileTopTabName !== routeName
      ) {
        backgroundApiProxy.serviceMarket.switchMarketTopTab(routeName);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isVerticalLayout, routeName]),
  );

  const layout = useWindowDimensions();

  const renderTabBar = useCallback(
    () => <MarketHeader marketTopTabName={marketTabName} />,
    [marketTabName],
  );

  const navigationState = useMemo(
    () => ({
      index: marketSwapTabRoutes.findIndex(
        (route) => route.key === marketTabName,
      ),
      routes: marketSwapTabRoutes,
    }),
    [marketTabName],
  );

  const setMarketSwapTabIndex = useCallback((index: number) => {
    setMarketSwapTabName(marketSwapTabRoutes[index].key);
  }, []);

  const intialLayout = useMemo(() => ({ width: layout.width }), [layout.width]);

  return (
    <Box flex={1} mt={`${top}px`}>
      {isVerticalLayout ? (
        <TabView
          renderTabBar={renderTabBar}
          navigationState={navigationState}
          renderScene={renderScene}
          onIndexChange={setMarketSwapTabIndex}
          initialLayout={intialLayout}
          // disable to avoid navigate animation
          animationEnabled={false}
        />
      ) : (
        <>
          {renderTabBar()}
          {marketTabName === TabRoutes.Swap ? (
            <Swap hideBottomTabBar />
          ) : (
            <MarketList />
          )}
        </>
      )}
    </Box>
  );
}
