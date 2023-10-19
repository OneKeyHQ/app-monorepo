import { memo, useCallback, useMemo } from 'react';

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useIntl } from 'react-intl';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import useIsVerticalLayout from '../../Provider/hooks/useIsVerticalLayout';
import { useThemeValue } from '../../Provider/hooks/useThemeValue';
import { makeTabScreenOptions } from '../GlobalScreenOptions';
import { createStackNavigator } from '../StackNavigator';
import NavigationBar from '../Tab/TabBar';

import type { ICON_NAMES } from '../../Icon';
import type { LocaleIds } from '../../locale';
import type { CommonNavigatorConfig } from './types';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs/src/types';
import type { ParamListBase } from '@react-navigation/routers';

export interface TabSubNavigatorConfig<
  RouteName extends string,
  P extends ParamListBase = ParamListBase,
> extends CommonNavigatorConfig<RouteName, P> {
  translationId: LocaleIds;
  disable?: boolean;
}

export interface TabNavigatorConfig<RouteName extends string> {
  name: RouteName;
  tabBarIcon: (focused?: boolean) => ICON_NAMES;
  translationId: LocaleIds;
  children: TabSubNavigatorConfig<any, any>[];
  freezeOnBlur?: boolean;
  disable?: boolean;
}

export interface TabNavigatorProps<RouteName extends string> {
  config: TabNavigatorConfig<RouteName>[];
}

const Stack = createStackNavigator();

function TabSubStackNavigator({
  config,
}: {
  config: TabSubNavigatorConfig<string, any>[];
}) {
  const [bgColor, titleColor] = useThemeValue(['bg', 'text']);
  const intl = useIntl();

  return (
    <Stack.Navigator>
      {config
        .filter(({ disable }) => !disable)
        .map(({ name, component, translationId }) => (
          <Stack.Screen
            key={name}
            name={name}
            component={component}
            options={({ navigation }: { navigation: any }) => ({
              freezeOnBlur: true,
              title: intl.formatMessage({ id: translationId }),
              ...makeTabScreenOptions({ navigation, bgColor, titleColor }),
            })}
          />
        ))}
    </Stack.Navigator>
  );
}

const TabSubStackNavigatorMemo = memo(TabSubStackNavigator);

const Tab = createBottomTabNavigator();

export function TabStackNavigator<RouteName extends string>({
  config,
}: TabNavigatorProps<RouteName>) {
  const isVerticalLayout = useIsVerticalLayout();
  const intl = useIntl();

  const tabBarCallback = useCallback(
    (props: BottomTabBarProps) => <NavigationBar {...props} />,
    [],
  );

  const tabComponents = useMemo(
    () =>
      config
        .filter(({ disable }) => !disable)
        .map(({ children, ...options }) => ({
          ...options,
          // eslint-disable-next-line react/no-unstable-nested-components
          children: () => <TabSubStackNavigatorMemo config={children} />,
        })),
    [config],
  );

  return (
    <Tab.Navigator
      tabBar={tabBarCallback}
      screenOptions={{
        headerShown: false,
        freezeOnBlur: true,
        // Native Load all tabs at once
        // Web Lazy load
        lazy: !platformEnv.isNative,
      }}
    >
      {tabComponents.map(({ name, children, ...options }) => (
        <Tab.Screen
          key={name}
          name={name}
          options={{
            ...options,
            tabBarLabel: intl.formatMessage({ id: options.translationId }),
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
