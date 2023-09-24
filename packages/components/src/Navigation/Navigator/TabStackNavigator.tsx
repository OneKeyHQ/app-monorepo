import type { ComponentType } from 'react';
import { useCallback, useMemo } from 'react';

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import useIsVerticalLayout from '../../Provider/hooks/useIsVerticalLayout';
import { makeHeaderScreenOptions } from '../Header';
import { createStackNavigator } from '../StackNavigator';
import NavigationBar from '../Tab/TabBar';

import type { CommonNavigatorConfig } from './types';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs/src/types';
import type { ParamListBase } from '@react-navigation/routers';

interface TabSubNavigatorConfig<P extends ParamListBase>
  extends CommonNavigatorConfig<P> {
  translationId: string;
}

export interface TabNavigatorConfig<P extends ParamListBase> {
  name: string;
  component: ComponentType<any>;
  tabBarIcon: (props: { focused?: boolean }) => string;
  translationId: string;
  disable?: boolean;
  children?: TabSubNavigatorConfig<P>[];
}

export interface TabNavigatorProps<P extends ParamListBase> {
  config: TabNavigatorConfig<P>[];
}

export function createTabNavigatorConfig<P extends ParamListBase>(
  config: TabNavigatorConfig<P>[],
): TabNavigatorConfig<P>[] {
  return config;
}

const Stack = createStackNavigator();

function makeTabStackScreen(screens: TabSubNavigatorConfig<any>[]) {
  return () => (
    <Stack.Navigator>
      {screens.map(({ name, component, translationId }) => (
        <Stack.Screen
          key={name}
          name={name}
          component={component}
          options={({ navigation }: { navigation: any }) => ({
            key: `${name as string}.Stack.Screen.component`,
            // TODO i18n
            title: translationId,
            headerShown: true,
            ...makeHeaderScreenOptions({
              isRootScreen: true,
              navigation,
            }),
          })}
        />
      ))}
    </Stack.Navigator>
  );
}

const Tab = createBottomTabNavigator();

export function TabStackNavigator<P extends ParamListBase>({
  config,
}: TabNavigatorProps<P>) {
  const isVerticalLayout = useIsVerticalLayout();

  const tabBarCallback = useCallback(
    (props: BottomTabBarProps) => <NavigationBar {...props} />,
    [],
  );

  const tabList = useMemo(
    () =>
      config
        .filter(({ disable }) => !disable)
        .map(({ name, translationId, tabBarIcon, children, component }) => {
          const srceenList: TabSubNavigatorConfig<any> = [
            {
              name,
              component,
              translationId,
            },
            ...(children || []),
          ];
          return (
            <Tab.Screen
              key={`Tab-Screen-${name}`}
              name={`Tab-Screen-${name}`}
              component={makeTabStackScreen(srceenList)}
              options={{
                tabBarIcon,
                tabBarLabel: translationId,
                // @ts-expect-error
                tabBarPosition: isVerticalLayout ? 'bottom' : 'left',
              }}
            />
          );
        }),
    [config, isVerticalLayout],
  );

  return (
    <Tab.Navigator
      tabBar={tabBarCallback}
      screenOptions={{
        headerShown: false,
        // freezeOnBlur: false,
        // lazy: !platformEnv.isNative,
      }}
    >
      {tabList}
    </Tab.Navigator>
  );
}
