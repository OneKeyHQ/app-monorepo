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

const TAB_BAR_STYLE_WIDTH_40 = { width: 40 };
const TAB_BAR_STYLE_ARRAY_WIDTH_40 = [{ width: 40 }];
const ENTER_EXIT_STYLE = { scale: 0.95, opacity: 0 };
const OVERFLOW_ANIMATION: [
  'quick',
  { opacity: { overshootClamping: boolean } },
] = ['quick', { opacity: { overshootClamping: true } }];
const PLATFORM_WEB_SHADOW_STYLE = {
  outlineColor: '$neutral3',
  outlineStyle: 'solid',
  outlineWidth: '$px',
  boxShadow:
    '0 4px 6px -4px rgba(0, 0, 0, 0.10), 0 10px 15px -3px rgba(0, 0, 0, 0.10)',
} as const;
const HOVER_STYLE_BG_HOVER = { bg: '$bgHover' } as const;
const PRESS_STYLE_BG_ACTIVE = { bg: '$bgActive' } as const;
const PLATFORM_WEB_APP_REGION_DRAG = { 'app-region': 'drag' } as const;

let lastBrowserRoute: string = ETabRoutes.Discovery;

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

  const tabBarStyleMemo = useMemo(
    () =>
      options.tabBarStyle
        ? [options.tabBarStyle, TAB_BAR_STYLE_WIDTH_40]
        : TAB_BAR_STYLE_ARRAY_WIDTH_40,
    [options.tabBarStyle],
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
            tabBarStyle={tabBarStyleMemo}
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
      tabBarStyleMemo,
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

  const renderTriggerMemo = useMemo(
    () => (
      <YStack
        p="$2"
        borderRadius="$2"
        bg={isActive ? '$bgActive' : undefined}
        hoverStyle={HOVER_STYLE_BG_HOVER}
        pressStyle={PRESS_STYLE_BG_ACTIVE}
        cursor="default"
        onPress={onPress}
      >
        <Icon
          name={iconName}
          size="$6"
          color={isActive ? '$iconActive' : '$iconSubdued'}
        />
      </YStack>
    ),
    [isActive, onPress, iconName],
  );

  return (
    <Tooltip
      placement="right"
      renderTrigger={renderTriggerMemo}
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
      hoverStyle={HOVER_STYLE_BG_HOVER}
      pressStyle={PRESS_STYLE_BG_ACTIVE}
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

function OverflowMenuItemWithHandler({
  route,
  isActive,
  options,
  handleTabPress,
  setIsOpen,
}: {
  route: NavigationState['routes'][0];
  isActive: boolean;
  options: BottomTabNavigationOptions & {
    collapseTabBarLabel?: string;
  };
  handleTabPress: (
    route: NavigationState['routes'][0],
    isActive: boolean,
    options?: {
      tabbarOnPress?: () => void;
      onPressWhenSelected?: () => void;
      callback?: () => void;
    },
  ) => void;
  setIsOpen: (value: boolean) => void;
}) {
  const handlePress = useCallback(() => {
    handleTabPress(route, isActive, {
      tabbarOnPress: (options as { tabbarOnPress?: () => void }).tabbarOnPress,
      onPressWhenSelected: (options as { onPressWhenSelected?: () => void })
        .onPressWhenSelected,
      callback: () => setIsOpen(false),
    });
  }, [handleTabPress, route, isActive, options, setIsOpen]);

  return (
    <OverflowMenuItem
      route={route}
      isActive={isActive}
      options={options}
      onPress={handlePress}
    />
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

  const handleContentHoverIn = useCallback(() => {
    clearTimer();
    setIsOpen(true);
  }, [clearTimer]);

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
            tabBarStyle={TAB_BAR_STYLE_WIDTH_40}
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
        enterStyle={ENTER_EXIT_STYLE}
        exitStyle={ENTER_EXIT_STYLE}
        animation={OVERFLOW_ANIMATION}
        onHoverIn={handleContentHoverIn}
        onHoverOut={handleHoverOut}
        $platform-web={PLATFORM_WEB_SHADOW_STYLE}
      >
        <YStack p="$1">
          {overflowRoutes.map((route) => {
            const currentFocusedRouteName = state.routes[state.index]?.name;
            const isActive = isRouteActive(
              route,
              currentFocusedRouteName,
              extraConfig?.name,
            );
            const { options } = descriptors[route.key];

            return (
              <OverflowMenuItemWithHandler
                key={route.key}
                route={route}
                isActive={isActive}
                options={options}
                handleTabPress={handleTabPress}
                setIsOpen={setIsOpen}
              />
            );
          })}
        </YStack>
      </TMPopover.Content>
    </TMPopover>
  );
}

function VisibleTabItemView({
  route,
  isActive,
  options,
  handleTabPress,
}: {
  route: NavigationState['routes'][0];
  isActive: boolean;
  options: BottomTabNavigationOptions & {
    actionList?: IActionListSection[];
    tabbarOnPress?: () => void;
    onPressWhenSelected?: () => void;
    trackId?: string;
    collapseTabBarLabel?: string;
    hideOnTabBar?: boolean;
  };
  handleTabPress: (
    route: NavigationState['routes'][0],
    isActive: boolean,
  ) => void;
}) {
  const handlePress = useCallback(() => {
    // When clicking the Discovery sidebar icon, restore the last
    // active browser route (Discovery or MultiTabBrowser) so that
    // switching to another tab and back preserves the dApp page.
    if (
      route.name === ETabRoutes.Discovery &&
      !isActive &&
      lastBrowserRoute !== ETabRoutes.Discovery
    ) {
      switchTab(lastBrowserRoute as ETabRoutes);
    } else {
      handleTabPress(route, isActive);
    }
  }, [route, isActive, handleTabPress]);

  return (
    <TabItemView
      route={route}
      onPress={handlePress}
      isActive={isActive}
      options={options}
    />
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

  // Track last active browser route (Discovery or MultiTabBrowser)
  useEffect(() => {
    if (focusedRouteName === ETabRoutes.Discovery) {
      lastBrowserRoute = ETabRoutes.Discovery;
    } else if (extraConfig?.name && focusedRouteName === extraConfig.name) {
      lastBrowserRoute = extraConfig.name;
    }
  }, [focusedRouteName, extraConfig?.name]);

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

  const containerStyle = useMemo(
    () => ({
      backgroundColor: theme.bgSidebar.val,
      paddingTop: top,
      zIndex: 2,
    }),
    [theme.bgSidebar.val, top],
  );

  const handleDevicePress = useCallback(() => {
    if (!deviceRoute) return;
    handleTabPress(deviceRoute, isDeviceActive);
    const { trackId } = descriptors[deviceRoute.key].options as {
      trackId?: string;
    };
    if (trackId) {
      defaultLogger.app.page.tabBarClick(trackId);
    }
  }, [deviceRoute, isDeviceActive, handleTabPress, descriptors]);

  return (
    <XStack testID="Desktop-AppSideBar-Container" style={containerStyle}>
      <YStack w={MIN_SIDEBAR_WIDTH}>
        {/* eslint-disable no-nested-ternary */}
        {platformEnv.isDesktopMac ? (
          // @ts-expect-error https://www.electronjs.org/docs/latest/tutorial/custom-window-interactions
          <XStack
            $platform-web={PLATFORM_WEB_APP_REGION_DRAG}
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
                  <VisibleTabItemView
                    key={route.key}
                    route={route}
                    isActive={isActive}
                    options={descriptors[route.key].options}
                    handleTabPress={handleTabPress}
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
                  onPress={handleDevicePress}
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
