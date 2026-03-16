/* eslint-disable @typescript-eslint/naming-convention */
import TabView from '@onekeyfe/react-native-tab-view';
import {
  CommonActions,
  type ParamListBase,
  type Route,
  type TabNavigationState,
} from '@react-navigation/native';

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

export function NativeBottomTabView({
  state,
  navigation,
  descriptors,
  tabBar,
  ...rest
}: Props) {
  return (
    <TabView
      {...rest}
      navigationState={state}
      renderScene={({ route }) => descriptors[route.key]?.render()}
      getActiveTintColor={({ route }) => {
        return descriptors[route.key]?.options.tabBarActiveTintColor;
      }}
      getLabelText={({ route }) => {
        const options = descriptors[route.key]?.options;

        if (options?.tabBarLabel !== undefined) {
          return options.tabBarLabel;
        }
        if (options?.title !== undefined) {
          return options.title;
        }
        return (route as Route<string>).name;
      }}
      getBadge={({ route }) => descriptors[route.key]?.options.tabBarBadge}
      getBadgeBackgroundColor={({ route }) =>
        descriptors[route.key]?.options.tabBarBadgeBackgroundColor
      }
      getBadgeTextColor={({ route }) =>
        descriptors[route.key]?.options.tabBarBadgeTextColor
      }
      getHidden={({ route }) => {
        const options = descriptors[route.key]?.options;
        return options?.tabBarItemHidden === true;
      }}
      getTestID={({ route }) =>
        descriptors[route.key]?.options.tabBarButtonTestID
      }
      getRole={({ route }) => descriptors[route.key]?.options.role}
      tabBar={
        tabBar ? () => tabBar({ state, descriptors, navigation }) : undefined
      }
      getIcon={({ route, focused }) => {
        const options = descriptors[route.key]?.options;

        if (options?.tabBarIcon) {
          const { tabBarIcon } = options;
          return tabBarIcon({ focused });
        }

        return null;
      }}
      getLazy={({ route }) => descriptors[route.key]?.options.lazy ?? true}
      getFreezeOnBlur={({ route }) =>
        descriptors[route.key]?.options.freezeOnBlur
      }
      getSceneStyle={({ route }) => descriptors[route.key]?.options.sceneStyle}
      onTabLongPress={(index) => {
        const route = state.routes[index];
        if (!route) {
          return;
        }

        navigation.emit({
          type: 'tabLongPress',
          target: route.key,
        });
      }}
      getPreventsDefault={({ route }) =>
        descriptors[route.key]?.options.preventsDefault
      }
      onIndexChange={(index) => {
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
      }}
    />
  );
}
