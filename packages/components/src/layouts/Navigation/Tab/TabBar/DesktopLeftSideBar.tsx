import type { ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import { Tooltip } from '@onekeyhq/components/src/actions';
import type { IActionListSection } from '@onekeyhq/components/src/actions';
import { useSafeAreaInsets } from '@onekeyhq/components/src/hooks';
import type { IKeyOfIcons } from '@onekeyhq/components/src/primitives';
import {
  Icon,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components/src/primitives';
import { TMPopover, useTheme } from '@onekeyhq/components/src/shared/tamagui';
import { MIN_SIDEBAR_WIDTH } from '@onekeyhq/components/src/utils/sidebar';
import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EAppEventBusNames } from '@onekeyhq/shared/src/eventBus/appEventBusNames';
import { ETranslations } from '@onekeyhq/shared/src/locale';
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
import type { GestureResponderEvent, LayoutChangeEvent } from 'react-native';

// Estimated height per tab item (icon ~40px + gap + label ~16-30px + padding 12px)
const ESTIMATED_TAB_ITEM_HEIGHT = 70;

function DesktopWinSidebarTop() {
  return (
    <XStack h={52} ai="center" jc="center" px="$4" className="app-region-drag">
      <XStack className="app-region-no-drag">
        <MenuHamburger />
      </XStack>
    </XStack>
  );
}

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
  const handleHoverIn = useCallback(() => {
    setIsContainerHovered(true);
  }, []);
  const handleHoverOut = useCallback(() => {
    setIsContainerHovered(false);
  }, []);
  const handlePress = useCallback(
    (event: GestureResponderEvent) => {
      setIsContainerHovered(false);
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
          onHoverIn={handleHoverIn}
          onHoverOut={handleHoverOut}
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
    [
      handlePress,
      handleHoverIn,
      handleHoverOut,
      isActive,
      isContainerHovered,
      options,
      route.name,
    ],
  );

  return contentMemo;
}

const isRouteActive = (
  route: NavigationState['routes'][0],
  focusedRouteName: string | undefined,
  extraConfigName: string | undefined,
) =>
  route.name === focusedRouteName ||
  (route.name === ETabRoutes.Discovery && focusedRouteName === extraConfigName);

function useTabAction(navigation: BottomTabBarProps['navigation']) {
  return useCallback(
    (
      route: NavigationState['routes'][0],
      isActive: boolean,
      options?: {
        tabbarOnPress?: () => void;
        onPressWhenSelected?: () => void;
        callback?: () => void;
      },
    ) => {
      if (options?.tabbarOnPress) {
        options.tabbarOnPress();
        options?.callback?.();
        return;
      }

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

      if (isActive) {
        options?.onPressWhenSelected?.();
      } else if (!event.defaultPrevented) {
        switchTab(route.name as ETabRoutes);
        if (route.name === ETabRoutes.Market) {
          appEventBus.emit(EAppEventBusNames.MarketHomePageEnter, {
            from: EEnterWay.HomeTab,
          });
        }
      }
      options?.callback?.();
    },
    [navigation],
  );
}

function SidebarBottomItem({
  route,
  isActive,
  options,
  onPress,
}: {
  route: NavigationState['routes'][0];
  isActive: boolean;
  options: BottomTabNavigationOptions & {
    collapseTabBarLabel?: string;
  };
  onPress: () => void;
}) {
  // @ts-expect-error tabBarIcon returns icon name string, not ReactNode
  const iconName = options?.tabBarIcon?.(isActive) as IKeyOfIcons;
  const label =
    options.collapseTabBarLabel ??
    (typeof options.tabBarLabel === 'string'
      ? options.tabBarLabel
      : undefined) ??
    route.name;

  return (
    <Tooltip
      placement="right"
      renderTrigger={
        <YStack
          p="$2"
          borderRadius="$2"
          bg={isActive ? '$bgActive' : undefined}
          hoverStyle={{ bg: '$bgHover' }}
          pressStyle={{ bg: '$bgActive' }}
          cursor="default"
          onPress={onPress}
        >
          <Icon
            name={iconName}
            size="$6"
            color={isActive ? '$iconActive' : '$iconSubdued'}
          />
        </YStack>
      }
      renderContent={label}
    />
  );
}

function OverflowMenuItem({
  route,
  isActive,
  options,
  onPress,
}: {
  route: NavigationState['routes'][0];
  isActive: boolean;
  options: BottomTabNavigationOptions & {
    collapseTabBarLabel?: string;
  };
  onPress: () => void;
}) {
  // @ts-expect-error tabBarIcon returns icon name string, not ReactNode
  const iconName = options?.tabBarIcon?.(isActive) as IKeyOfIcons;
  const label =
    options.collapseTabBarLabel ??
    (typeof options.tabBarLabel === 'string'
      ? options.tabBarLabel
      : undefined) ??
    route.name;

  return (
    <XStack
      px="$3"
      py="$2"
      gap="$2.5"
      ai="center"
      borderRadius="$2"
      bg={isActive ? '$bgActive' : undefined}
      cursor="default"
      userSelect="none"
      hoverStyle={{ bg: '$bgHover' }}
      pressStyle={{ bg: '$bgActive' }}
      onPress={onPress}
    >
      <Icon
        name={iconName}
        size="$5"
        color={isActive ? '$iconActive' : '$iconSubdued'}
      />
      <SizableText size="$bodyMdMedium" color="$text" numberOfLines={1}>
        {label}
      </SizableText>
    </XStack>
  );
}

function OverflowMoreButton({
  overflowRoutes,
  isAnyOverflowActive,
  state,
  descriptors,
  navigation,
  extraConfig,
}: {
  overflowRoutes: NavigationState['routes'];
  isAnyOverflowActive: boolean;
  state: NavigationState;
  descriptors: BottomTabBarProps['descriptors'];
  navigation: BottomTabBarProps['navigation'];
  extraConfig?: ITabNavigatorExtraConfig<string>;
}) {
  const intl = useIntl();
  const [isHovered, setIsHovered] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleTabPress = useTabAction(navigation);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleHoverIn = useCallback(() => {
    setIsHovered(true);
    clearTimer();
    timerRef.current = setTimeout(() => setIsOpen(true), 150);
  }, [clearTimer]);

  const handleHoverOut = useCallback(() => {
    setIsHovered(false);
    clearTimer();
    timerRef.current = setTimeout(() => setIsOpen(false), 200);
  }, [clearTimer]);

  const handlePopoverOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setIsOpen(false);
      setIsHovered(false);
    }
  }, []);

  useEffect(() => () => clearTimer(), [clearTimer]);

  const moreLabel = intl.formatMessage({ id: ETranslations.global_more });

  return (
    <TMPopover
      offset={8}
      placement="right-start"
      open={isOpen}
      onOpenChange={handlePopoverOpenChange}
    >
      <TMPopover.Trigger asChild>
        <YStack
          w="100%"
          ai="center"
          gap="$0.5"
          pt={6}
          pb={6}
          onHoverIn={handleHoverIn}
          onHoverOut={handleHoverOut}
        >
          <DesktopTabItem
            isContainerHovered={isHovered || isOpen}
            selected={isAnyOverflowActive}
            tabBarStyle={{ width: 40 }}
            icon={isAnyOverflowActive ? 'DotHorSolid' : 'DotHorOutline'}
            label=""
            showTooltip={false}
            testID="tab-more"
          />
          <SizableText
            size="$bodyXsMedium"
            cursor="default"
            color="$text"
            textAlign="center"
            numberOfLines={1}
          >
            {moreLabel}
          </SizableText>
        </YStack>
      </TMPopover.Trigger>
      <TMPopover.Content
        trapFocus={false}
        unstyled
        w={200}
        p={0}
        bg="$bg"
        borderRadius="$3"
        enterStyle={{ scale: 0.95, opacity: 0 }}
        exitStyle={{ scale: 0.95, opacity: 0 }}
        animation={['quick', { opacity: { overshootClamping: true } }]}
        onHoverIn={() => {
          clearTimer();
          setIsOpen(true);
        }}
        onHoverOut={handleHoverOut}
        $platform-web={{
          outlineColor: '$neutral3',
          outlineStyle: 'solid',
          outlineWidth: '$px',
          boxShadow:
            '0 4px 6px -4px rgba(0, 0, 0, 0.10), 0 10px 15px -3px rgba(0, 0, 0, 0.10)',
        }}
      >
        <YStack p="$1">
          {overflowRoutes.map((route) => {
            const focusedRouteName = state.routes[state.index]?.name;
            const isActive = isRouteActive(
              route,
              focusedRouteName,
              extraConfig?.name,
            );
            const { options } = descriptors[route.key];

            return (
              <OverflowMenuItem
                key={route.key}
                route={route}
                isActive={isActive}
                options={options}
                onPress={() =>
                  handleTabPress(route, isActive, {
                    tabbarOnPress: (options as { tabbarOnPress?: () => void })
                      .tabbarOnPress,
                    onPressWhenSelected: (
                      options as { onPressWhenSelected?: () => void }
                    ).onPressWhenSelected,
                    callback: () => setIsOpen(false),
                  })
                }
              />
            );
          })}
        </YStack>
      </TMPopover.Content>
    </TMPopover>
  );
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
  const handleTabPress = useTabAction(navigation);

  const isShowWebTabBar = platformEnv.isDesktop || platformEnv.isNativeIOS;

  // Current focused route for browser submenu
  const focusedRouteName = state.routes[state.index]?.name;

  const [maxVisibleCount, setMaxVisibleCount] = useState(0);
  const handleTabsContainerLayout = useCallback((event: LayoutChangeEvent) => {
    const height = event.nativeEvent.layout.height;
    if (height <= 0) return;
    const count = Math.floor(height / ESTIMATED_TAB_ITEM_HEIGHT);
    setMaxVisibleCount((prev) => (prev === count ? prev : count));
  }, []);

  const { visibleRoutes, overflowRoutes, deviceRoute } = useMemo(() => {
    let currentDeviceRoute: (typeof routes)[0] | undefined;
    const validRoutes = routes.filter((route) => {
      const { options } = descriptors[route.key] as {
        options: {
          hiddenIcon?: boolean;
          hideOnTabBar?: boolean;
        };
      };
      if (options.hiddenIcon || options.hideOnTabBar) {
        return false;
      }
      if (route.name === ETabRoutes.DeviceManagement) {
        currentDeviceRoute = route;
        return false;
      }
      if (isShowWebTabBar && route.name === extraConfig?.name) {
        return false;
      }
      return true;
    });

    if (maxVisibleCount === 0 || validRoutes.length <= maxVisibleCount) {
      return {
        visibleRoutes: validRoutes,
        overflowRoutes: [] as typeof validRoutes,
        deviceRoute: currentDeviceRoute,
      };
    }
    const visibleCount = Math.max(0, maxVisibleCount - 1);
    return {
      visibleRoutes: validRoutes.slice(0, visibleCount),
      overflowRoutes: validRoutes.slice(visibleCount),
      deviceRoute: currentDeviceRoute,
    };
  }, [
    routes,
    descriptors,
    isShowWebTabBar,
    extraConfig?.name,
    maxVisibleCount,
  ]);

  const isAnyOverflowActive = useMemo(() => {
    return overflowRoutes.some((route) =>
      isRouteActive(route, focusedRouteName, extraConfig?.name),
    );
  }, [overflowRoutes, focusedRouteName, extraConfig?.name]);

  const isDeviceActive = deviceRoute
    ? isRouteActive(deviceRoute, focusedRouteName, extraConfig?.name)
    : false;

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
        {/* eslint-disable no-nested-ternary */}
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
        ) : platformEnv.isDesktopWin || platformEnv.isDesktopLinux ? (
          <DesktopWinSidebarTop />
        ) : (
          <MenuHamburger />
        )}
        {/* eslint-enable no-nested-ternary */}
        <YStack flex={1} testID="Desktop-AppSideBar-Content-Container">
          <YStack flex={1}>
            {!platformEnv.isDesktopWithCustomTitleBar &&
            !platformEnv.isNativeIOSPad ? (
              <XStack ai="center" jc="center" px="$4" py="$3">
                <Icon
                  name="OnekeyLogoIllus"
                  width={28}
                  height={28}
                  color="$text"
                />
              </XStack>
            ) : null}
            <YStack
              flex={1}
              px="$3"
              alignItems="center"
              onLayout={handleTabsContainerLayout}
            >
              {visibleRoutes.map((route) => {
                const isActive = isRouteActive(
                  route,
                  focusedRouteName,
                  extraConfig?.name,
                );
                return (
                  <TabItemView
                    key={route.key}
                    route={route}
                    onPress={() => handleTabPress(route, isActive)}
                    isActive={isActive}
                    options={descriptors[route.key].options}
                  />
                );
              })}
              {overflowRoutes.length > 0 ? (
                <OverflowMoreButton
                  overflowRoutes={overflowRoutes}
                  isAnyOverflowActive={isAnyOverflowActive}
                  state={state}
                  descriptors={descriptors}
                  navigation={navigation}
                  extraConfig={extraConfig}
                />
              ) : null}
            </YStack>
            {deviceRoute ? (
              <YStack px="$3" pb="$2" alignItems="center">
                <SidebarBottomItem
                  route={deviceRoute}
                  isActive={isDeviceActive}
                  options={descriptors[deviceRoute.key].options}
                  onPress={() => {
                    handleTabPress(deviceRoute, isDeviceActive);
                    const { trackId } = descriptors[deviceRoute.key]
                      .options as {
                      trackId?: string;
                    };
                    if (trackId) {
                      defaultLogger.app.page.tabBarClick(trackId);
                    }
                  }}
                />
              </YStack>
            ) : null}
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
