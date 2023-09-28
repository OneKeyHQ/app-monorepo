import { useCallback, useMemo } from 'react';

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import useIsVerticalLayout from '../../Provider/hooks/useIsVerticalLayout';
import { makeTabScreenOptions } from '../GlobalScreenOptions';
import { createStackNavigator } from '../StackNavigator';
import NavigationBar from '../Tab/TabBar';

import type { CommonNavigatorConfig } from './types';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs/src/types';
import type { ParamListBase } from '@react-navigation/routers';

export interface TabSubNavigatorConfig<
  RouteName extends string,
  P extends ParamListBase,
> extends CommonNavigatorConfig<RouteName, P> {
  translationId: string;
}

export interface TabNavigatorConfig<
  RouteName extends string,
  P extends ParamListBase,
> extends CommonNavigatorConfig<RouteName, P> {
  tabBarIcon: (props: { focused?: boolean }) => string;
  translationId: string;
  disable?: boolean;
  children?: TabSubNavigatorConfig<any, any>[];
}

export interface TabNavigatorProps<
  RouteName extends string,
  P extends ParamListBase,
> {
  config: TabNavigatorConfig<RouteName, P>[];
}

const Stack = createStackNavigator();

function TabSubStackNavigator({
  screens,
}: {
  screens: TabSubNavigatorConfig<any, any>[];
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

const Tab = createBottomTabNavigator();

export function TabStackNavigator<
  RouteName extends string,
  P extends ParamListBase,
>({ config }: TabNavigatorProps<RouteName, P>) {
  const isVerticalLayout = useIsVerticalLayout();

  const tabBarCallback = useCallback(
    (props: BottomTabBarProps) => <NavigationBar {...props} />,
    [],
  );

  const tabComponents = useMemo(
    () =>
      config
        .filter(({ disable }) => !disable)
        .map(({ name, translationId, tabBarIcon, children, component }) => {
          const screenList: TabSubNavigatorConfig<any, any>[] = [
            {
              name,
              component,
              translationId,
            },
            ...(children || []),
          ];
          return {
            name: `Tab-Screen-${name}`,
            tabBarLabel: translationId,
            tabBarIcon,
            // eslint-disable-next-line react/no-unstable-nested-components
            children: () => <TabSubStackNavigator screens={screenList} />,
          };
        }),
    [config],
  );

  return (
    <Tab.Navigator
      tabBar={tabBarCallback}
      screenOptions={{
        headerShown: false,
        // freezeOnBlur: false,
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
