/* eslint-disable @typescript-eslint/naming-convention */
import { useCallback } from 'react';

import TabView from '@onekeyfe/react-native-tab-view';
import {
  CommonActions,
  type ParamListBase,
  type Route,
  type TabNavigationState,
} from '@react-navigation/native';

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

export function NativeBottomTabView({
  state,
  navigation,
  descriptors,
  tabBar,
  ...rest
}: Props) {
  const renderScene = useCallback(
    ({ route }: { route: Route<string> }) =>
      descriptors[route.key]?.render() ?? null,
    [descriptors],
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
        return false;
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

      const accepted =
        focused ||
        (!event.defaultPrevented &&
          !descriptors[route.key]?.options.preventsDefault);

      if (!accepted) {
        return false;
      }

      if (!focused) {
        navigation.dispatch({
          ...CommonActions.navigate(route),
          target: state.key,
        });
      }

      return true;
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
