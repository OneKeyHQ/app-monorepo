import { memo, useCallback, useMemo } from 'react';

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useIntl } from 'react-intl';

import { useMedia } from '@onekeyhq/components/src/hooks/useStyle';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useTheme } from '../../../hooks';
import { makeTabScreenOptions } from '../GlobalScreenOptions';
import { createStackNavigator } from '../StackNavigator';
import NavigationBar from '../Tab/TabBar';

import type { ITabNavigatorProps, ITabSubNavigatorConfig } from './types';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

const Stack = createStackNavigator();

function BasicTabSubStackNavigator({
  config,
}: {
  config: ITabSubNavigatorConfig<string, any>[] | null;
}) {
  const theme = useTheme();
  const intl = useIntl();

  if (!config || config.length === 0) {
    return null;
  }

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
              ...makeTabScreenOptions({
                navigation,
                bgColor: theme.bgApp.val,
                titleColor: theme.text.val,
              }),
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

const useTabBarPosition = platformEnv.isNative
  ? () => 'bottom' as const
  : () => {
      const media = useMedia();
      return media.md ? 'bottom' : 'left';
    };

export function TabStackNavigator<RouteName extends string>({
  config,
  extraConfig,
  showTabBar = true,
  bottomMenu,
  webPageTabBar,
}: ITabNavigatorProps<RouteName>) {
  const intl = useIntl();
  const tabBarCallback = useCallback(
    (props: BottomTabBarProps) => (
      <NavigationBar
        {...props}
        extraConfig={extraConfig}
        bottomMenu={bottomMenu}
        webPageTabBar={webPageTabBar}
      />
    ),
    [webPageTabBar, bottomMenu, extraConfig],
  );

  const tabComponents = useMemo(
    () =>
      config
        .filter(({ disable }) => !disable)
        .map(({ children, ...options }) => ({
          ...options,
          // eslint-disable-next-line react/no-unstable-nested-components
          children: () => <TabSubStackNavigator config={children} />,
        })),
    [config],
  );

  const tabBarPosition = useTabBarPosition();

  const tabScreens = useMemo(() => {
    const screens = tabComponents.map(({ name, children, ...options }) => (
      <Tab.Screen
        key={name}
        name={name}
        options={{
          ...options,
          tabBarLabel: intl.formatMessage({ id: options.translationId }),
          tabBarPosition,
          // @ts-expect-error Custom property for tab bar handling
          collapseTabBarLabel: options.collapseSideBarTranslationId
            ? intl.formatMessage({ id: options.collapseSideBarTranslationId })
            : undefined,
          hideOnTabBar: options.hideOnTabBar,
          tabbarOnPress: options.tabbarOnPress,
        }}
      >
        {children}
      </Tab.Screen>
    ));

    if (extraConfig) {
      const children = () => (
        <TabSubStackNavigator config={extraConfig.children} />
      );
      screens.push(
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
    return screens;
  }, [extraConfig, intl, tabBarPosition, tabComponents]);

  return (
    <Tab.Navigator
      tabBar={showTabBar ? tabBarCallback : () => null}
      screenOptions={{
        headerShown: false,
        freezeOnBlur: true,
        lazy: false,
      }}
    >
      {tabScreens}
    </Tab.Navigator>
  );
}
