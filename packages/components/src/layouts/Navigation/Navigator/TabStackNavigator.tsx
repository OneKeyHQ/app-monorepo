import { memo, useCallback, useMemo } from 'react';

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useIntl } from 'react-intl';
import { useMedia } from 'tamagui';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useOrientation, useThemeValue } from '../../../hooks';
import { makeTabScreenOptions } from '../GlobalScreenOptions';
import { createStackNavigator } from '../StackNavigator';
import NavigationBar from '../Tab/TabBar';

import type { ITabNavigatorProps, ITabSubNavigatorConfig } from './types';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

const Stack = createStackNavigator();

function BasicTabSubStackNavigator({
  config,
}: {
  config: ITabSubNavigatorConfig<string, any>[];
}) {
  const [bgColor, titleColor] = useThemeValue(['bgApp', 'text']);
  const intl = useIntl();
  return (
    <Stack.Navigator>
      {config
        .filter(({ disable }) => !disable)
        .map(({ name, component, translationId, headerShown = true }) => (
          <Stack.Screen
            key={name}
            name={name}
            component={component}
            options={({ navigation }: { navigation: any }) => ({
              freezeOnBlur: true,
              title: translationId
                ? intl.formatMessage({
                    id: translationId,
                  })
                : '',
              ...makeTabScreenOptions({ navigation, bgColor, titleColor }),
              headerShown,
            })}
          />
        ))}
    </Stack.Navigator>
  );
}

const TabSubStackNavigatorMemo = memo(BasicTabSubStackNavigator);

export const TabSubStackNavigator = TabSubStackNavigatorMemo;

const Tab = createBottomTabNavigator();

const useTabBarPosition = platformEnv.isNativeIOSPad
  ? () => {
      const isLandscape = useOrientation();
      return isLandscape ? 'left' : 'bottom';
    }
  : () => {
      const media = useMedia();
      return platformEnv.isNativeAndroid || media.md ? 'bottom' : 'left';
    };

export function TabStackNavigator<RouteName extends string>({
  config,
  extraConfig,
}: ITabNavigatorProps<RouteName>) {
  const intl = useIntl();
  const tabBarCallback = useCallback(
    (props: BottomTabBarProps) => (
      <NavigationBar {...props} extraConfig={extraConfig} />
    ),
    [extraConfig],
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

  const tabBarPosition = useTabBarPosition();

  const tabScreens = tabComponents.map(({ name, children, ...options }) => (
    <Tab.Screen
      key={name}
      name={name}
      options={{
        ...options,
        tabBarLabel: intl.formatMessage({ id: options.translationId }),
        tabBarPosition,
        // @ts-expect-error Custom property for tab bar handling
        tabbarOnPress: options.tabbarOnPress,
      }}
    >
      {children}
    </Tab.Screen>
  ));

  if (extraConfig) {
    const children = () => (
      <TabSubStackNavigatorMemo config={extraConfig.children} />
    );
    tabScreens.push(
      <Tab.Screen
        key={extraConfig.name}
        name={extraConfig.name}
        options={{
          freezeOnBlur: true,
          tabBarPosition,
        }}
      >
        {children}
      </Tab.Screen>,
    );
  }
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
      {tabScreens}
    </Tab.Navigator>
  );
}
