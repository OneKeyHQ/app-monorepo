/* eslint-disable react/destructuring-assignment */
/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable @typescript-eslint/no-shadow */
/* eslint-disable no-shadow */
import { getHeaderTitle, Header, Screen } from '@react-navigation/elements';
import type {
  ParamListBase,
  TabNavigationState,
} from '@react-navigation/native';
import * as React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import SafeAreaProviderCompat from './SafeAreaProviderCompat';
import type {
  BottomTabBarProps,
  BottomTabDescriptorMap,
  BottomTabHeaderProps,
  BottomTabNavigationConfig,
  BottomTabNavigationHelpers,
} from '../types';
import BottomTabBarHeightCallbackContext from '../utils/BottomTabBarHeightCallbackContext';
import BottomTabBarHeightContext from '../utils/BottomTabBarHeightContext';
import BottomTabBar from './BottomTabBar';
import { getTabBarHeight } from './BottomTabBar/Foot';
import { MaybeScreen, MaybeScreenContainer } from './ScreenFallback';

import { useUserDevice } from '../../Provider/hooks';

type Props = BottomTabNavigationConfig & {
  state: TabNavigationState<ParamListBase>;
  navigation: BottomTabNavigationHelpers;
  descriptors: BottomTabDescriptorMap;
};

export default function BottomTabView(props: Props) {
  const { size } = useUserDevice();

  const {
    tabBar = (props: BottomTabBarProps) => <BottomTabBar {...props} />,
    state,
    navigation,
    descriptors,
    safeAreaInsets,
    detachInactiveScreens = Platform.OS === 'web' ||
      Platform.OS === 'android' ||
      Platform.OS === 'ios',
    sceneContainerStyle,
  } = props;

  const focusedRouteKey = state.routes[state.index].key;
  const [loaded, setLoaded] = React.useState([focusedRouteKey]);

  if (!loaded.includes(focusedRouteKey)) {
    setLoaded([...loaded, focusedRouteKey]);
  }

  const dimensions = SafeAreaProviderCompat.initialMetrics.frame;
  const [tabBarHeight, setTabBarHeight] = React.useState(() =>
    getTabBarHeight({
      state,
      descriptors,
      dimensions,
      layout: { width: dimensions.width, height: 0 },
      insets: {
        ...SafeAreaProviderCompat.initialMetrics.insets,
        ...props.safeAreaInsets,
      },
      style: descriptors[state.routes[state.index].key].options.tabBarStyle,
    }),
  );

  const renderTabBar = () => (
    <SafeAreaInsetsContext.Consumer>
      {(insets) =>
        tabBar({
          state,
          descriptors,
          navigation,
          insets: {
            top: safeAreaInsets?.top ?? insets?.top ?? 0,
            right: safeAreaInsets?.right ?? insets?.right ?? 0,
            bottom: safeAreaInsets?.bottom ?? insets?.bottom ?? 0,
            left: safeAreaInsets?.left ?? insets?.left ?? 0,
          },
        })
      }
    </SafeAreaInsetsContext.Consumer>
  );

  const { routes } = state;

  return (
    <SafeAreaProviderCompat
      style={
        !['SMALL', 'NORMAL'].includes(size)
          ? { 'flexDirection': 'row-reverse' }
          : undefined
      }
    >
      <MaybeScreenContainer
        enabled={detachInactiveScreens}
        style={styles.container}
      >
        {routes.map((route, index) => {
          const descriptor = descriptors[route.key];
          const { lazy = true, unmountOnBlur } = descriptor.options;
          const isFocused = state.index === index;

          if (unmountOnBlur && !isFocused) {
            return null;
          }

          if (lazy && !loaded.includes(route.key) && !isFocused) {
            // Don't render a lazy screen if we've never navigated to it
            return null;
          }

          const {
            header = ({ layout, options }: BottomTabHeaderProps) => (
              <Header
                {...options}
                layout={layout}
                title={getHeaderTitle(options, route.name)}
              />
            ),
          } = descriptor.options;

          return (
            <MaybeScreen
              key={route.key}
              style={[StyleSheet.absoluteFill, { zIndex: isFocused ? 0 : -1 }]}
              visible={isFocused}
              enabled={detachInactiveScreens}
            >
              <BottomTabBarHeightContext.Provider value={tabBarHeight}>
                <Screen
                  focused={isFocused}
                  route={descriptor.route}
                  navigation={descriptor.navigation}
                  headerShown={descriptor.options.headerShown}
                  headerTransparent={descriptor.options.headerTransparent}
                  headerStatusBarHeight={
                    descriptor.options.headerStatusBarHeight
                  }
                  header={header({
                    layout: dimensions,
                    route: descriptor.route,
                    navigation: descriptor.navigation,
                    options: descriptor.options,
                  })}
                  style={sceneContainerStyle}
                >
                  {descriptor.render()}
                </Screen>
              </BottomTabBarHeightContext.Provider>
            </MaybeScreen>
          );
        })}
      </MaybeScreenContainer>
      <BottomTabBarHeightCallbackContext.Provider value={setTabBarHeight}>
        {renderTabBar()}
      </BottomTabBarHeightCallbackContext.Provider>
    </SafeAreaProviderCompat>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
});
