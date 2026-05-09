import { memo, useCallback, useEffect, useMemo, useState } from 'react';

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useIntl } from 'react-intl';

import { useMedia } from '@onekeyhq/components/src/hooks/useStyle';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { Portal } from '../../../hocs';
import { useTheme } from '../../../hooks';
import { Stack as PrimitiveStack } from '../../../primitives';
import { makeTabScreenOptions } from '../GlobalScreenOptions';
import { createStackNavigator } from '../StackNavigator';
import NavigationBar from '../Tab/TabBar';

import type { ITabNavigatorProps, ITabSubNavigatorConfig } from './types';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

// Keep this string in sync with WEB_VIEW_DESKTOP_SLOT_ID in
// packages/kit/src/routes/WebView/desktopSlotConsts.ts
// Inlined here because @onekeyhq/components must not import from @onekeyhq/kit
// (see CLAUDE.md import hierarchy rules).
const WEB_VIEW_DESKTOP_SLOT_ID = 'web-view-desktop-slot';

// Render the desktop main-content portal slot only once across all tabs.
// react-native-root-portal warns if multiple PortalContainers share the same
// name; tabs lazily mount over the lifetime of the app and stay mounted, so
// we gate on first mount to keep a single global container for the slot.
let isWebViewDesktopSlotMounted = false;
function WebViewDesktopMainContentSlot() {
  const [isOwner] = useState(() => {
    if (!isWebViewDesktopSlotMounted) {
      isWebViewDesktopSlotMounted = true;
      return true;
    }
    return false;
  });
  useEffect(
    () => () => {
      if (isOwner) {
        isWebViewDesktopSlotMounted = false;
      }
    },
    [isOwner],
  );
  if (!isOwner) {
    return null;
  }
  return (
    <PrimitiveStack
      position="absolute"
      top={0}
      bottom={0}
      left={0}
      right={0}
      pointerEvents="box-none"
    >
      <Portal.Container name={WEB_VIEW_DESKTOP_SLOT_ID} />
    </PrimitiveStack>
  );
}

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
        .map(({ name, component, translationId, headerShown = true }) => {
          // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop
          const screenOptions = ({ navigation }: { navigation: any }) => ({
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
          });
          return (
            <Stack.Screen
              key={name}
              name={name}
              component={component}
              options={screenOptions}
            />
          );
        })}
    </Stack.Navigator>
  );
}

const TabSubStackNavigatorMemo = memo(BasicTabSubStackNavigator);

export const TabSubStackNavigator = TabSubStackNavigatorMemo;

const DesktopSlotWrappedSubStack = memo(function DesktopSlotWrappedSubStack({
  config,
}: {
  config: ITabSubNavigatorConfig<string, any>[] | null;
}) {
  if (!platformEnv.isDesktop) {
    return <TabSubStackNavigator config={config} />;
  }
  return (
    <PrimitiveStack flex={1} position="relative">
      <TabSubStackNavigator config={config} />
      <WebViewDesktopMainContentSlot />
    </PrimitiveStack>
  );
});

const Tab = createBottomTabNavigator();

const emptyTabBar = () => null;

const tabScreenOptions = {
  headerShown: false,
  freezeOnBlur: true,
  lazy: false,
};

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
  const [tabBarHidden, setTabBarHidden] = useState(false);

  useEffect(() => {
    const handler = (hidden: boolean) => {
      setTabBarHidden((prev) => (prev === hidden ? prev : hidden));
    };
    appEventBus.on(EAppEventBusNames.HideTabBar, handler);
    return () => {
      appEventBus.off(EAppEventBusNames.HideTabBar, handler);
    };
  }, []);

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
          children: () => <DesktopSlotWrappedSubStack config={children} />,
        })),
    [config],
  );

  const tabBarPosition = useTabBarPosition();

  const tabScreens = useMemo(() => {
    const screens = tabComponents.map(({ name, children, ...options }) => {
      // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop
      const screenOptions = {
        ...options,
        tabBarLabel: intl.formatMessage({ id: options.translationId }),
        tabBarPosition,
        collapseTabBarLabel: options.collapseSideBarTranslationId
          ? intl.formatMessage({ id: options.collapseSideBarTranslationId })
          : undefined,
        hideOnTabBar: options.hideOnTabBar,
        tabbarOnPress: options.tabbarOnPress,
      } as any;
      return (
        <Tab.Screen key={name} name={name} options={screenOptions}>
          {children}
        </Tab.Screen>
      );
    });

    if (extraConfig) {
      const children = () => (
        <DesktopSlotWrappedSubStack config={extraConfig.children} />
      );
      // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop
      const extraScreenOptions = {
        freezeOnBlur: true,
        tabBarPosition,
      } as any;
      screens.push(
        <Tab.Screen
          key={extraConfig.name}
          name={extraConfig.name}
          options={extraScreenOptions}
        >
          {children}
        </Tab.Screen>,
      );
    }
    return screens;
  }, [extraConfig, intl, tabBarPosition, tabComponents]);

  return (
    <Tab.Navigator
      tabBar={showTabBar && !tabBarHidden ? tabBarCallback : emptyTabBar}
      screenOptions={tabScreenOptions}
    >
      {tabScreens}
    </Tab.Navigator>
  );
}
