/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable react/destructuring-assignment */
/* eslint-disable @typescript-eslint/no-shadow */
import { useMemo, useState } from 'react';

import {
  Header,
  SafeAreaProviderCompat,
  Screen,
  getHeaderTitle,
} from '@react-navigation/elements';
import { Platform, StyleSheet } from 'react-native';

import { useIsVerticalLayout, useThemeValue } from '@onekeyhq/components';

import NavigationBar from '../../NavigationBar';
import { getTabBarHeight } from '../../NavigationBar/MobileBottomTabBar';
import BottomTabBarHeightCallbackContext from '../utils/BottomTabBarHeightCallbackContext';
import BottomTabBarHeightContext from '../utils/BottomTabBarHeightContext';

import { MaybeScreen, MaybeScreenContainer } from './ScreenFallback';

import type {
  BottomTabDescriptorMap,
  BottomTabHeaderProps,
  BottomTabNavigationConfig,
  BottomTabNavigationHelpers,
} from '../types';
import type {
  ParamListBase,
  TabNavigationState,
} from '@react-navigation/native';

type Props = BottomTabNavigationConfig & {
  state: TabNavigationState<ParamListBase>;
  navigation: BottomTabNavigationHelpers;
  descriptors: BottomTabDescriptorMap;
};

export default function BottomTabView(props: Props) {
  const isVerticalLayout = useIsVerticalLayout();
  const bgColor = useThemeValue('background-default');
  const {
    state,
    navigation,
    descriptors,
    detachInactiveScreens = Platform.OS === 'web' ||
      Platform.OS === 'android' ||
      Platform.OS === 'ios',
    sceneContainerStyle,
  } = props;

  const focusedRouteKey = state.routes[state.index].key;
  const [loaded, setLoaded] = useState([focusedRouteKey]);

  if (!loaded.includes(focusedRouteKey)) {
    setLoaded([...loaded, focusedRouteKey]);
  }

  const dimensions = SafeAreaProviderCompat.initialMetrics.frame;
  const [tabBarHeight, setTabBarHeight] = useState(() =>
    getTabBarHeight({
      insets: {
        ...SafeAreaProviderCompat.initialMetrics.insets,
        ...props.safeAreaInsets,
      },
    }),
  );

  const tabBar = useMemo(
    () => (
      <NavigationBar
        navigation={navigation}
        state={state}
        descriptors={descriptors}
      />
    ),
    [descriptors, navigation, state],
  );

  const { routes } = state;

  return (
    <SafeAreaProviderCompat
      style={{ flexDirection: isVerticalLayout ? 'column' : 'row-reverse' }}
    >
      <MaybeScreenContainer
        enabled={detachInactiveScreens}
        hasTwoStates
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
            freezeOnBlur,
            header = ({ layout, options }: BottomTabHeaderProps) => (
              <Header
                {...options}
                layout={layout}
                title={getHeaderTitle(options, route.name)}
              />
            ),
          } = descriptor.options;

          // @ts-ignore
          // @ts-ignore
          return (
            <MaybeScreen
              key={route.key}
              style={[StyleSheet.absoluteFill, { zIndex: isFocused ? 0 : -1 }]}
              visible={isFocused}
              enabled={detachInactiveScreens}
              freezeOnBlur={freezeOnBlur}
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
                  style={[sceneContainerStyle, { backgroundColor: bgColor }]}
                >
                  {descriptor.render()}
                </Screen>
              </BottomTabBarHeightContext.Provider>
            </MaybeScreen>
          );
        })}
      </MaybeScreenContainer>
      <BottomTabBarHeightCallbackContext.Provider value={setTabBarHeight}>
        {tabBar}
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
