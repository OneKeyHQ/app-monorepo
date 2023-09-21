/* eslint-disable @typescript-eslint/no-use-before-define,@typescript-eslint/no-unused-vars */
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
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { useThemeValue } from '@onekeyhq/components';

import useIsVerticalLayout from '../../../../Provider/hooks/useIsVerticalLayout';
import BottomTabBarHeightCallbackContext from '../utils/BottomTabBarHeightCallbackContext';
import BottomTabBarHeightContext from '../utils/BottomTabBarHeightContext';

import BottomTabBar, { getTabBarHeight } from './BottomTabBar';
import { MaybeScreen, MaybeScreenContainer } from './ScreenFallback';

import type {
  BottomTabBarProps,
  BottomTabDescriptorMap,
  BottomTabHeaderProps,
  BottomTabNavigationConfig,
  BottomTabNavigationHelpers,
  BottomTabNavigationProp,
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
  const [loaded, setLoaded] = useState([focusedRouteKey]);

  if (!loaded.includes(focusedRouteKey)) {
    setLoaded([...loaded, focusedRouteKey]);
  }

  const dimensions = SafeAreaProviderCompat.initialMetrics.frame;
  const [tabBarHeight, setTabBarHeight] = useState(() =>
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
            headerShown,
            headerStatusBarHeight,
            headerTransparent,
          } = descriptor.options;

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
                  headerShown={headerShown}
                  headerStatusBarHeight={headerStatusBarHeight}
                  headerTransparent={headerTransparent}
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
