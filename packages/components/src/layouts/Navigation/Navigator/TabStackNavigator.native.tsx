import { memo, useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EEnterWay } from '@onekeyhq/shared/src/logger/scopes/dex';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes/tab';
import { ESwapSource } from '@onekeyhq/shared/types/swap/types';

import {
  ESplitViewType,
  useIsSplitView,
  useSplitViewType,
  useTheme,
  useThemeName,
} from '../../../hooks';
import { createNativeBottomTabNavigator } from '../BottomTabs';
import { makeTabScreenOptions } from '../GlobalScreenOptions';
import { createStackNavigator } from '../StackNavigator';

import type { ITabNavigatorProps, ITabSubNavigatorConfig } from './types';

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

const NativeTab = createNativeBottomTabNavigator();

const extraScreenOptions = {
  tabBarItemHidden: true,
};

const nativeTabScreenOptions = {
  // iOS: disable freezeOnBlur to prevent react-freeze from suspending tab
  // content when a modal is on top. When frozen, Jotai/React state updates
  // (e.g. network switch) don't commit until the tab regains focus — but
  // the unfreeze path on iOS can fail to flush pending commits, leaving
  // the UI visually stale until a touch forces re-layout.
  // Android keeps freeze enabled (no observed issue).
  freezeOnBlur: !platformEnv.isNativeIOS,
  preventsDefault: false,
  lazy: false,
};

export function TabStackNavigator<RouteName extends string>({
  config,
  extraConfig,
}: ITabNavigatorProps<RouteName>) {
  const intl = useIntl();
  const theme = useTheme();
  // Subscribe to theme name so OS dark/light switch triggers re-render —
  // `theme.*.val` reads are non-reactive on native.
  useThemeName();
  const [tabBarHidden, setTabBarHidden] = useState(false);

  // Listen for HideTabBar events to show/hide the tab bar
  useEffect(() => {
    const handler = (hidden: boolean) => {
      setTabBarHidden(hidden);
    };
    appEventBus.on(EAppEventBusNames.HideTabBar, handler);
    return () => {
      appEventBus.off(EAppEventBusNames.HideTabBar, handler);
    };
  }, []);

  // Handle tab press events for logging and event bus notifications
  const handleTabPress = useCallback((routeName: string) => {
    if (routeName === ETabRoutes.Swap) {
      defaultLogger.swap.enterSwap.enterSwap({
        enterFrom: ESwapSource.TAB,
      });
    }
    if (routeName === ETabRoutes.Market) {
      appEventBus.emit(EAppEventBusNames.MarketHomePageEnter, {
        from: EEnterWay.HomeTab,
      });
    }
  }, []);

  const tabScreens = useMemo(() => {
    const screens = config
      .filter(({ disable }) => !disable)
      .filter(({ hideOnTabBar }) => !hideOnTabBar)
      .filter(({ hiddenIcon }) => !hiddenIcon)
      .map(({ name, children, nativeTabBarIcon, translationId, trackId }) => {
        // eslint-disable-next-line react/no-unstable-nested-components
        const ScreenComponent = () => (
          <TabSubStackNavigator config={children} />
        );

        // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop
        const options = {
          // Type assertion needed because our INativeTabBarIcon uses string for sfSymbol
          // while react-native-bottom-tabs expects SFSymbol type from sf-symbols-typescript
          tabBarIcon: nativeTabBarIcon as any,
          tabBarLabel: intl.formatMessage({ id: translationId }),
        };

        // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop
        const listeners = {
          tabPress: () => {
            handleTabPress(name);
            if (trackId) {
              defaultLogger.app.page.tabBarClick(trackId);
            }
          },
        };

        return (
          <NativeTab.Screen
            key={name}
            name={name}
            options={options}
            listeners={listeners}
          >
            {ScreenComponent}
          </NativeTab.Screen>
        );
      });

    // Add extra config screen if exists (but hidden from tab bar)
    if (extraConfig) {
      // eslint-disable-next-line react/no-unstable-nested-components
      const ExtraScreenComponent = () => (
        <TabSubStackNavigator config={extraConfig.children} />
      );

      screens.push(
        <NativeTab.Screen
          key={extraConfig.name}
          name={extraConfig.name}
          options={extraScreenOptions}
        >
          {ExtraScreenComponent}
        </NativeTab.Screen>,
      );
    }

    return screens;
  }, [config, extraConfig, intl, handleTabPress]);

  const splitViewType = useSplitViewType();
  const isLandscape = useIsSplitView();
  const hidden = useMemo(() => {
    switch (splitViewType) {
      case ESplitViewType.MAIN:
        return false;
      case ESplitViewType.SUB:
        return isLandscape;
      default:
        return tabBarHidden;
    }
  }, [tabBarHidden, splitViewType, isLandscape]);
  const tabBarStyle = useMemo(
    () =>
      // On iOS 26+ omit backgroundColor so UITabBar renders the system
      // Liquid Glass material via configureWithDefaultBackground. Setting
      // appearance.backgroundColor in @onekeyfe/react-native-tab-view would
      // overwrite the glass material with an opaque fill.
      platformEnv.isNativeIOS26Plus
        ? undefined
        : { backgroundColor: theme.bg.val },
    [theme.bg.val],
  );

  return (
    <NativeTab.Navigator
      labeled
      hapticFeedbackEnabled
      disablePageAnimations
      ignoreBottomInsets
      sidebarAdaptable={false}
      tabBarHidden={hidden}
      tabBarActiveTintColor={theme.iconActive.val}
      tabBarInactiveTintColor={theme.iconSubdued.val}
      tabBarStyle={tabBarStyle}
      screenOptions={nativeTabScreenOptions}
    >
      {tabScreens}
    </NativeTab.Navigator>
  );
}
