import { memo, useCallback, useMemo } from 'react';

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import useIsVerticalLayout from '../../Provider/hooks/useIsVerticalLayout';
import { makeTabScreenOptions } from '../GlobalScreenOptions';
import { createStackNavigator } from '../StackNavigator';
import NavigationBar from '../Tab/TabBar';

import type { ICON_NAMES } from '../../Icon';
import type { CommonNavigatorConfig } from './types';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs/src/types';
import type { ParamListBase } from '@react-navigation/routers';

export interface TabSubNavigatorConfig<
  RouteName extends string,
  P extends ParamListBase = ParamListBase,
> extends CommonNavigatorConfig<RouteName, P> {
  translationId: string;
}

export interface TabNavigatorConfig<RouteName extends string> {
  name: RouteName;
  tabBarIcon: (focused?: boolean) => ICON_NAMES;
  translationId: string;
  children: TabSubNavigatorConfig<any, any>[];
  disable?: boolean;
}

export interface TabNavigatorProps<RouteName extends string> {
  config: TabNavigatorConfig<RouteName>[];
}

const Stack = createStackNavigator();

function TabSubStackNavigator({
  screens,
}: {
  screens: TabSubNavigatorConfig<string, any>[];
}) {
  return (
    <Stack.Navigator>
      {screens.map(({ name, component, translationId }) => (
        <Stack.Screen
          key={name}
          name={name}
          component={component}
          options={({ navigation }: { navigation: any }) => ({
            // TODO i18n
            title: translationId,
            ...makeTabScreenOptions({ navigation }),
          })}
        />
      ))}
    </Stack.Navigator>
  );
}

const MemoizedTabSubStackNavigator = memo(TabSubStackNavigator);

const Tab = createBottomTabNavigator();

export function TabStackNavigator<RouteName extends string>({
  config,
}: TabNavigatorProps<RouteName>) {
  const isVerticalLayout = useIsVerticalLayout();

  const tabBarCallback = useCallback(
    (props: BottomTabBarProps) => <NavigationBar {...props} />,
    [],
  );

  const tabComponents = useMemo(
    () =>
      config
        .filter(({ disable }) => !disable)
        .map(({ name, translationId, tabBarIcon, children }) => ({
          name,
          tabBarLabel: translationId,
          tabBarIcon,
          // eslint-disable-next-line react/no-unstable-nested-components
          children: () => <MemoizedTabSubStackNavigator screens={children} />,
        })),
    [config],
  );

  return (
    <Tab.Navigator
      tabBar={tabBarCallback}
      screenOptions={{
        headerShown: false,
        freezeOnBlur: true,
        // lazy default is true
      }}
    >
      {tabComponents.map(({ name, children, ...options }) => (
        <Tab.Screen
          key={name}
          name={name}
          options={{
            ...options,
            // @ts-expect-error BottomTabBar V7
            tabBarPosition: isVerticalLayout ? 'bottom' : 'left',
          }}
        >
          {children}
        </Tab.Screen>
      ))}
    </Tab.Navigator>
  );
}
