import { useCallback, useEffect, useMemo, useRef } from 'react';

import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { useWindowDimensions } from 'react-native';
import { SceneMap, TabView } from 'react-native-tab-view';

import {
  Box,
  useIsVerticalLayout,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { TabRoutes } from '../../routes/routesEnum';
import Swap from '../Swap';

import MarketHeader from './Components/MarketList/MarketTopHeader';
import {
  marketSwapTabRoutes,
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

export function ScreenMarketOrSwap({
  routeName,
}: {
  routeName: MarketTopTabName;
}) {
  const { top } = useSafeAreaInsets();
  const mobileTopTabName = useMobileMarketTopTabName();
  const isFocused = useIsFocused();
  const isFirstMount = useRef(true);

  const isVerticalLayout = useIsVerticalLayout();
  // if (lastIsVerticalLayout === undefined) {
  //   lastIsVerticalLayout = isVerticalLayout;
  // }
  const marketTabName =
    isVerticalLayout && platformEnv.isNative ? mobileTopTabName : routeName;

  useEffect(() => {
    if (isFocused) {
      if (isFirstMount.current) {
        isFirstMount.current = false;
        return;
      }

      // align on non-first render
      if (routeName !== mobileTopTabName) {
        setMarketSwapTabName(routeName);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocused]);

  // useFocusEffect(
  //   useCallback(() => {
  //     // reset when orientation change
  //     if (isVerticalLayout !== lastIsVerticalLayout) {
  //       // console.log('orientation change');
  //       if (isVerticalLayout) {
  //         // big -> small screen
  //         // align to current RouteName
  //         setMarketSwapTabName(routeName);
  //       } else {
  //         // small -> big screen
  //         // force navigate to align to current mobileTopTabName
  //         setMarketSwapTabName(mobileTopTabName, true);
  //       }
  //     }
  //     lastIsVerticalLayout = isVerticalLayout;
  //   }, [isVerticalLayout, mobileTopTabName, routeName]),
  // );

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
    setTimeout(() => setMarketSwapTabName(marketSwapTabRoutes[index].key));
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
