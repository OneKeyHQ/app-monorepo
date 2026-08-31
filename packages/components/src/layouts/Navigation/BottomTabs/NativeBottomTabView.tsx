/* eslint-disable @typescript-eslint/naming-convention */
import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import TabView from '@onekeyfe/react-native-tab-view';
import {
  CommonActions,
  type ParamListBase,
  type Route,
  type TabNavigationState,
} from '@react-navigation/native';
import { StyleSheet, View } from 'react-native';

import { Spinner, Stack } from '../../../primitives';

import type {
  NativeBottomTabDescriptorMap,
  NativeBottomTabNavigationConfig,
  NativeBottomTabNavigationHelpers,
} from './types';

type Props = NativeBottomTabNavigationConfig & {
  state: TabNavigationState<ParamListBase>;
  navigation: NativeBottomTabNavigationHelpers;
  descriptors: NativeBottomTabDescriptorMap;
};

const styles = StyleSheet.create({
  scene: {
    flex: 1,
  },
});

const COLD_SCENE_LOADING_DURATION_MS = 500;

function SceneLoadingView() {
  return (
    <Stack
      position="absolute"
      top={0}
      right={0}
      bottom={0}
      left={0}
      alignItems="center"
      justifyContent="center"
      backgroundColor="$bgApp"
      pointerEvents="none"
    >
      <Spinner size="large" />
    </Stack>
  );
}

function SceneReadyView({
  routeKey,
  focused,
  ready,
  onReady,
  children,
}: {
  routeKey: string;
  focused: boolean;
  ready: boolean;
  onReady: (routeKey: string) => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (ready || !focused) {
      return;
    }

    const timer = setTimeout(() => {
      onReady(routeKey);
    }, COLD_SCENE_LOADING_DURATION_MS);

    return () => clearTimeout(timer);
  }, [focused, onReady, ready, routeKey]);

  return (
    <View style={styles.scene}>
      {children}
      {ready ? null : <SceneLoadingView />}
    </View>
  );
}

export function NativeBottomTabView({
  state,
  navigation,
  descriptors,
  tabBar,
  ...rest
}: Props) {
  const [readyRouteKeys, setReadyRouteKeys] = useState<string[]>(() => {
    const focusedRouteKey = state.routes[state.index]?.key;
    return focusedRouteKey ? [focusedRouteKey] : [];
  });
  const handleSceneReady = useCallback((routeKey: string) => {
    setReadyRouteKeys((current) =>
      current.includes(routeKey) ? current : [...current, routeKey],
    );
  }, []);
  const renderScene = useCallback(
    ({ route }: { route: Route<string> }) => (
      <SceneReadyView
        routeKey={route.key}
        focused={state.routes[state.index]?.key === route.key}
        ready={readyRouteKeys.includes(route.key)}
        onReady={handleSceneReady}
      >
        {descriptors[route.key]?.render()}
      </SceneReadyView>
    ),
    [descriptors, handleSceneReady, readyRouteKeys, state.index, state.routes],
  );
  const renderLazyPlaceholder = useCallback(() => <SceneLoadingView />, []);
  const getActiveTintColor = useCallback(
    ({ route }: { route: Route<string> }) =>
      descriptors[route.key]?.options.tabBarActiveTintColor,
    [descriptors],
  );
  const getLabelText = useCallback(
    ({ route }: { route: Route<string> }) => {
      const options = descriptors[route.key]?.options;

      if (options?.tabBarLabel !== undefined) {
        return options.tabBarLabel;
      }
      if (options?.title !== undefined) {
        return options.title;
      }
      return route.name;
    },
    [descriptors],
  );
  const getBadge = useCallback(
    ({ route }: { route: Route<string> }) =>
      descriptors[route.key]?.options.tabBarBadge,
    [descriptors],
  );
  const getBadgeBackgroundColor = useCallback(
    ({ route }: { route: Route<string> }) =>
      descriptors[route.key]?.options.tabBarBadgeBackgroundColor,
    [descriptors],
  );
  const getBadgeTextColor = useCallback(
    ({ route }: { route: Route<string> }) =>
      descriptors[route.key]?.options.tabBarBadgeTextColor,
    [descriptors],
  );
  const getHidden = useCallback(
    ({ route }: { route: Route<string> }) => {
      const options = descriptors[route.key]?.options;
      return options?.tabBarItemHidden === true;
    },
    [descriptors],
  );
  const getTestID = useCallback(
    ({ route }: { route: Route<string> }) =>
      descriptors[route.key]?.options.tabBarButtonTestID,
    [descriptors],
  );
  const getRole = useCallback(
    ({ route }: { route: Route<string> }) =>
      descriptors[route.key]?.options.role,
    [descriptors],
  );
  const tabBarCallback = useCallback(
    () => (tabBar ? tabBar({ state, descriptors, navigation }) : undefined),
    [tabBar, state, descriptors, navigation],
  );
  const getIcon = useCallback(
    ({ route, focused }: { route: Route<string>; focused: boolean }) => {
      const options = descriptors[route.key]?.options;

      if (options?.tabBarIcon) {
        const { tabBarIcon } = options;
        return tabBarIcon({ focused });
      }

      return null;
    },
    [descriptors],
  );
  const getLazy = useCallback(
    ({ route }: { route: Route<string> }) => {
      // Preloaded routes bypass lazy — treat as already loaded
      if (state.preloadedRouteKeys?.includes(route.key)) {
        return false;
      }
      return descriptors[route.key]?.options.lazy ?? true;
    },
    [descriptors, state.preloadedRouteKeys],
  );
  const getFreezeOnBlur = useCallback(
    ({ route }: { route: Route<string> }) => {
      // Don't freeze preloaded routes so they can complete their first render
      if (state.preloadedRouteKeys?.includes(route.key)) return false;
      return descriptors[route.key]?.options.freezeOnBlur;
    },
    [descriptors, state.preloadedRouteKeys],
  );
  const getSceneStyle = useCallback(
    ({ route }: { route: Route<string> }) =>
      descriptors[route.key]?.options.sceneStyle,
    [descriptors],
  );
  const onTabLongPress = useCallback(
    (index: number) => {
      const route = state.routes[index];
      if (!route) {
        return;
      }

      navigation.emit({
        type: 'tabLongPress',
        target: route.key,
      });
    },
    [state.routes, navigation],
  );
  const getPreventsDefault = useCallback(
    ({ route }: { route: Route<string> }) =>
      descriptors[route.key]?.options.preventsDefault,
    [descriptors],
  );
  const onIndexChange = useCallback(
    (index: number) => {
      const focused = index === state.index;
      const route = state.routes[index];
      if (!route) {
        return;
      }

      const event = navigation.emit({
        type: 'tabPress',
        target: route.key,
        canPreventDefault: true,
      });

      if (
        !focused &&
        !event.defaultPrevented &&
        !descriptors[route.key]?.options.preventsDefault
      ) {
        navigation.dispatch({
          ...CommonActions.navigate(route),
          target: state.key,
        });
      }
    },
    [state.index, state.routes, state.key, navigation, descriptors],
  );

  return (
    <TabView
      {...rest}
      navigationState={state}
      renderScene={renderScene}
      renderLazyPlaceholder={renderLazyPlaceholder}
      getActiveTintColor={getActiveTintColor}
      getLabelText={getLabelText}
      getBadge={getBadge}
      getBadgeBackgroundColor={getBadgeBackgroundColor}
      getBadgeTextColor={getBadgeTextColor}
      getHidden={getHidden}
      getTestID={getTestID}
      getRole={getRole}
      tabBar={tabBar ? tabBarCallback : undefined}
      getIcon={getIcon}
      getLazy={getLazy}
      getFreezeOnBlur={getFreezeOnBlur}
      getSceneStyle={getSceneStyle}
      onTabLongPress={onTabLongPress}
      getPreventsDefault={getPreventsDefault}
      onIndexChange={onIndexChange}
    />
  );
}
