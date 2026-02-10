import type { ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { IActionListSection } from '@onekeyhq/components/src/actions';
import { useSafeAreaInsets } from '@onekeyhq/components/src/hooks';
import type { IKeyOfIcons } from '@onekeyhq/components/src/primitives';
import {
  Icon,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components/src/primitives';
import { useTheme } from '@onekeyhq/components/src/shared/tamagui';
import { MIN_SIDEBAR_WIDTH } from '@onekeyhq/components/src/utils/sidebar';
import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EAppEventBusNames } from '@onekeyhq/shared/src/eventBus/appEventBusNames';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EEnterWay } from '@onekeyhq/shared/src/logger/scopes/dex';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes/tab';
import { ESwapSource } from '@onekeyhq/shared/types/swap/types';

import { switchTab } from '../../Navigator/NavigationContainer';

import { BrowserSubmenuColumn } from './BrowserSubmenuColumn';
import { DesktopTabItem } from './DesktopTabItem';
import { MenuHamburger } from './Menu';

import type { ITabNavigatorExtraConfig } from '../../Navigator/types';
import type {
  BottomTabBarProps,
  BottomTabNavigationOptions,
} from '@react-navigation/bottom-tabs';
import type { NavigationState } from '@react-navigation/routers';
import type { GestureResponderEvent } from 'react-native';

function TabItemView({
  isActive,
  route,
  onPress,
  onPressOut,
  options,
}: {
  isActive: boolean;
  route: NavigationState['routes'][0];
  onPress: () => void;
  onPressOut?: () => void;
  options: BottomTabNavigationOptions & {
    actionList?: IActionListSection[];
    tabbarOnPress?: () => void;
    onPressWhenSelected?: () => void;
    trackId?: string;
    collapseTabBarLabel?: string;
    hideOnTabBar?: boolean;
  };
}) {
  useEffect(() => {
    // @ts-expect-error
    const activeIcon = options?.tabBarIcon?.(true) as IKeyOfIcons;
    // @ts-expect-error
    const inActiveIcon = options?.tabBarIcon?.(false) as IKeyOfIcons;
    // Avoid icon jitter during lazy loading by prefetching icons.
    void Icon.prefetch(activeIcon, inActiveIcon);
  }, [options]);

  const [isContainerHovered, setIsContainerHovered] = useState(false);
  const handlePress = useCallback(
    (event: GestureResponderEvent) => {
      const press = (options.tabbarOnPress ?? onPress) as (
        event: GestureResponderEvent,
      ) => void | undefined;
      press?.(event);
      onPressOut?.();
    },
    [onPress, onPressOut, options],
  );

  const contentMemo = useMemo(
    () =>
      options.hideOnTabBar ? null : (
        <YStack
          className="sidebar-tab-item"
          w="100%"
          ai="center"
          gap="$0.5"
          pt={6}
          pb={6}
          onPress={handlePress}
          onHoverIn={() => {
            setIsContainerHovered(true);
          }}
          onHoverOut={() => {
            setIsContainerHovered(false);
          }}
        >
          <DesktopTabItem
            isContainerHovered={isContainerHovered}
            onPress={handlePress}
            onPressWhenSelected={options.onPressWhenSelected}
            trackId={options.trackId}
            aria-current={isActive ? 'page' : undefined}
            selected={isActive}
            tabBarStyle={[options.tabBarStyle, { width: 40 }]}
            // @ts-expect-error
            icon={options?.tabBarIcon?.(isActive) as IKeyOfIcons}
            label=""
            actionList={options.actionList}
            testID={route.name.toLowerCase()}
          />
          <SizableText
            size="$bodyXsMedium"
            cursor="default"
            color="$text"
            textAlign="center"
            numberOfLines={2}
            wordWrap="break-word"
            maxWidth="100%"
          >
            {options.collapseTabBarLabel ?? options.tabBarLabel ?? route.name}
          </SizableText>
        </YStack>
      ),
    [handlePress, isActive, isContainerHovered, options, route.name],
  );

  return contentMemo;
}

export function DesktopLeftSideBar({
  navigation,
  state,
  descriptors,
  extraConfig,
  bottomMenu,
  webPageTabBar,
}: BottomTabBarProps & {
  extraConfig?: ITabNavigatorExtraConfig<string>;
  bottomMenu: ReactElement;
  webPageTabBar: ReactElement;
}) {
  const { routes } = state;
  const { top } = useSafeAreaInsets(); // used for ipad
  const theme = useTheme();

  const isShowWebTabBar = platformEnv.isDesktop || platformEnv.isNativeIOS;

  // Current focused route for browser submenu
  const focusedRouteName = state.routes[state.index]?.name;

  const routesNotHidden = useMemo(() => {
    return routes.filter((route) => {
      const { options } = descriptors[route.key] as {
        options: {
          hiddenIcon?: boolean;
        };
      };
      if (options.hiddenIcon) {
        return false;
      }
      // Filter out browser tab when BrowserSubmenuColumn is shown
      if (isShowWebTabBar && route.name === extraConfig?.name) {
        return false;
      }
      return true;
    });
  }, [routes, descriptors, isShowWebTabBar, extraConfig?.name]);

  const tabs = useMemo(() => {
    const newRoutes = routesNotHidden.map((route) => {
      const focusRoute = state.routes[state.index];
      const focus =
        focusRoute.name === route.name ||
        (route.name === ETabRoutes.Discovery &&
          focusRoute.name === extraConfig?.name);
      const { options } = descriptors[route.key];
      const onPress = () => {
        const event = navigation.emit({
          type: 'tabPress',
          target: route.key,
          canPreventDefault: true,
        });
        if (route.name === 'Swap') {
          defaultLogger.swap.enterSwap.enterSwap({
            enterFrom: ESwapSource.TAB,
          });
        }
        if (!focus && !event.defaultPrevented) {
          switchTab(route.name as ETabRoutes);
          if (route.name === ETabRoutes.Market) {
            appEventBus.emit(EAppEventBusNames.MarketHomePageEnter, {
              from: EEnterWay.HomeTab,
            });
          }
        }
      };

      return (
        <TabItemView
          key={route.key}
          route={route}
          onPress={onPress}
          isActive={focus}
          options={options}
        />
      );
    });

    return newRoutes;
  }, [routesNotHidden, descriptors, state, navigation, extraConfig?.name]);

  return (
    <XStack
      testID="Desktop-AppSideBar-Container"
      style={{
        backgroundColor: theme.bgSidebar.val,
        paddingTop: top,
        zIndex: 2,
      }}
    >
      <YStack w={MIN_SIDEBAR_WIDTH}>
        {!platformEnv.isDesktopMac ? <MenuHamburger /> : null}
        {platformEnv.isDesktopMac ? (
          // @ts-expect-error https://www.electronjs.org/docs/latest/tutorial/custom-window-interactions
          <XStack
            $platform-web={{
              'app-region': 'drag',
            }}
            h={52}
            ai="center"
            jc="flex-end"
            px="$4"
          />
        ) : null}
        <YStack flex={1} testID="Desktop-AppSideBar-Content-Container">
          <YStack flex={1}>
            {!platformEnv.isDesktopMac && !platformEnv.isNativeIOSPad ? (
              <XStack ai="center" jc="center" px="$4" py="$3">
                <Icon
                  name="OnekeyLogoIllus"
                  width={28}
                  height={28}
                  color="$text"
                />
              </XStack>
            ) : null}
            <YStack flex={1} px="$3" alignItems="center">
              {tabs}
            </YStack>
            {bottomMenu}
          </YStack>
        </YStack>
      </YStack>
      <BrowserSubmenuColumn
        webPageTabBar={webPageTabBar}
        focusedRouteName={focusedRouteName}
        multiTabBrowserRouteName={extraConfig?.name}
      />
    </XStack>
  );
}
