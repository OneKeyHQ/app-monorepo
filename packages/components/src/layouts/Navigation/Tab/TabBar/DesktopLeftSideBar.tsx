import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { MotiView } from 'moti';
import { useIntl } from 'react-intl';

import { IconButton, Tooltip } from '@onekeyhq/components/src/actions';
import type {
  IActionListSection,
  ITooltipRef,
} from '@onekeyhq/components/src/actions';
import {
  EPortalContainerConstantName,
  Portal,
} from '@onekeyhq/components/src/hocs';
import {
  useSafeAreaInsets,
  useShortcuts,
} from '@onekeyhq/components/src/hooks';
import type { IKeyOfIcons } from '@onekeyhq/components/src/primitives';
import {
  Icon,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components/src/primitives';
import { useTheme } from '@onekeyhq/components/src/shared/tamagui';
import {
  MAX_SIDEBAR_WIDTH,
  MIN_SIDEBAR_WIDTH,
} from '@onekeyhq/components/src/utils/sidebar';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { useAppSideBarStatusAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/settings';
import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EAppEventBusNames } from '@onekeyhq/shared/src/eventBus/appEventBusNames';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EEnterWay } from '@onekeyhq/shared/src/logger/scopes/dex';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes/tab';
import { EShortcutEvents } from '@onekeyhq/shared/src/shortcuts/shortcuts.enum';
import { ESwapSource } from '@onekeyhq/shared/types/swap/types';

import { switchTab } from '../../Navigator/NavigationContainer';

import { DesktopTabItem } from './DesktopTabItem';

import type { ITabNavigatorExtraConfig } from '../../Navigator/types';
import type {
  BottomTabBarProps,
  BottomTabNavigationOptions,
} from '@react-navigation/bottom-tabs';
import type {
  NavigationRoute,
  NavigationState,
  ParamListBase,
} from '@react-navigation/routers';
import type { MotiTransition } from 'moti';
import type { GestureResponderEvent } from 'react-native';

function TabItemView({
  isCollapse,
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
    shortcutKey?: EShortcutEvents;
    tabbarOnPress?: () => void;
    onPressWhenSelected?: () => void;
    trackId?: string;
    collapseTabBarLabel?: string;
    hideOnTabBar?: boolean;
  };
  isCollapse?: boolean;
}) {
  useMemo(() => {
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
          ai={isCollapse ? 'center' : undefined}
          gap={isCollapse ? '$0.5' : undefined}
          pt={isCollapse ? 6 : undefined}
          pb={isCollapse ? 6 : undefined}
          onPress={handlePress}
          onHoverIn={() => {
            if (isCollapse) {
              setIsContainerHovered(true);
            }
          }}
          onHoverOut={() => {
            if (isCollapse) {
              setIsContainerHovered(false);
            }
          }}
        >
          <DesktopTabItem
            isContainerHovered={isCollapse ? isContainerHovered : false}
            onPress={handlePress}
            onPressWhenSelected={options.onPressWhenSelected}
            trackId={options.trackId}
            aria-current={isActive ? 'page' : undefined}
            selected={isActive}
            shortcutKey={options.shortcutKey}
            tabBarStyle={[
              options.tabBarStyle,
              isCollapse ? { width: 36 } : undefined,
            ]}
            // @ts-expect-error
            icon={options?.tabBarIcon?.(isActive) as IKeyOfIcons}
            label={
              (isCollapse ? '' : options.tabBarLabel ?? route.name) as string
            }
            actionList={options.actionList}
            testID={route.name.toLowerCase()}
          />
          {isCollapse ? (
            <SizableText
              size="$bodyXsMedium"
              cursor="default"
              color="$text"
              textAlign="center"
            >
              {options.collapseTabBarLabel ?? options.tabBarLabel ?? route.name}
            </SizableText>
          ) : null}
        </YStack>
      ),
    [
      handlePress,
      isActive,
      isCollapse,
      isContainerHovered,
      options,
      route.name,
    ],
  );

  return contentMemo;
}

function MoreTabItemView({
  routes,
  navigation,
  state,
  descriptors,
}: {
  routes: NavigationRoute<ParamListBase, string>[];
  navigation: BottomTabBarProps['navigation'];
  state: BottomTabBarProps['state'];
  descriptors: BottomTabBarProps['descriptors'];
}) {
  const intl = useIntl();

  const routeNames = useMemo(() => {
    return routes.map((route) => route.name);
  }, [routes]);

  const focusRouteName = useMemo(() => {
    return state.routes[state.index].name;
  }, [state.routes, state.index]);

  const isFocusedRouteNames = useMemo(() => {
    return routeNames.includes(focusRouteName);
  }, [routeNames, focusRouteName]);

  const tooltipRef = useRef<ITooltipRef>(null);

  const routesElements = useMemo(() => {
    return routes.map((route) => {
      const focus = focusRouteName === route.name;
      const { options } = descriptors[route.key] as {
        options: {
          tabbarOnPress?: () => void;
        };
      };
      const onPress = async () => {
        await tooltipRef.current?.closeTooltip();
        const event = navigation.emit({
          type: 'tabPress',
          target: route.key,
          canPreventDefault: true,
        });
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
          isCollapse={false}
        />
      );
    });
  }, [routes, focusRouteName, descriptors, navigation]);

  return (
    <Tooltip
      ref={tooltipRef as React.RefObject<ITooltipRef>}
      placement="right-start"
      offset={{ mainAxis: 6, crossAxis: -28 }}
      hovering
      renderTrigger={
        <YStack userSelect="none" gap="$0.5" py="$1.5">
          <YStack
            p="$2"
            borderRadius="$2"
            hoverStyle={{ bg: '$bgHover' }}
            bg={isFocusedRouteNames ? '$bgActive' : undefined}
          >
            <Icon
              name="DotHorSolid"
              size="$5"
              color={isFocusedRouteNames ? '$iconActive' : '$iconSubdued'}
            />
          </YStack>
          <SizableText
            flex={1}
            numberOfLines={1}
            cursor="default"
            color="$text"
            textAlign="center"
            size="$bodyXsMedium"
          >
            {intl.formatMessage({
              id: ETranslations.global_more,
            })}
          </SizableText>
        </YStack>
      }
      renderContent={
        <YStack minWidth={180} pb="$1">
          <SizableText size="$headingSm" pb="$1" pl="$2.5">
            {intl.formatMessage({
              id: ETranslations.global_more,
            })}
          </SizableText>
          {routesElements}
        </YStack>
      }
    />
  );
}

export function DesktopLeftSideBar({
  navigation,
  state,
  descriptors,
  extraConfig,
}: BottomTabBarProps & {
  extraConfig?: ITabNavigatorExtraConfig<string>;
}) {
  const intl = useIntl();
  const { routes } = state;
  const [{ isCollapsed: isCollapse }, setAppSideBarStatus] =
    useAppSideBarStatusAtom();
  const { top } = useSafeAreaInsets(); // used for ipad
  const theme = useTheme();
  const [isHovering, setIsHovering] = useState(false);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isShowWebTabBar = platformEnv.isDesktop || platformEnv.isNativeIOS;

  const routesNotHidden = useMemo(() => {
    return routes.filter((route) => {
      const { options } = descriptors[route.key] as {
        options: {
          hiddenIcon?: boolean;
        };
      };
      return !options.hiddenIcon;
    });
  }, [routes, descriptors]);

  const tabs = useMemo(() => {
    const inMoreActionRoutes: NavigationRoute<ParamListBase, string>[] = [];
    let filteredRoutes: NavigationRoute<ParamListBase, string>[] = [];
    if (isCollapse) {
      for (let index = 0; index < routesNotHidden.length; index += 1) {
        const route = routesNotHidden[index];
        const { options } = descriptors[route.key] as {
          options: {
            inMoreAction?: boolean;
          };
        };
        if (options.inMoreAction) {
          inMoreActionRoutes.push(route);
        } else {
          filteredRoutes.push(route);
        }
      }
    } else {
      filteredRoutes = routesNotHidden;
    }

    const newRoutes = filteredRoutes.map((route) => {
      const focusRoute = state.routes[state.index];
      const focus = focusRoute.name === route.name;
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

      if (isShowWebTabBar && route.name === extraConfig?.name) {
        return (
          <YStack flex={1} key={route.key}>
            <Portal.Container name={Portal.Constant.WEB_TAB_BAR} />
          </YStack>
        );
      }

      return (
        <TabItemView
          key={route.key}
          route={route}
          onPress={onPress}
          isActive={focus}
          options={options}
          isCollapse={isCollapse}
        />
      );
    });

    if (inMoreActionRoutes.length > 0) {
      newRoutes.splice(
        newRoutes.length - 2,
        0,
        <MoreTabItemView
          key="more-tab-item"
          routes={inMoreActionRoutes}
          navigation={navigation}
          state={state}
          descriptors={descriptors}
        />,
      );
    }
    return newRoutes;
  }, [
    isCollapse,
    routesNotHidden,
    descriptors,
    state,
    isShowWebTabBar,
    extraConfig?.name,
    navigation,
  ]);

  const handleHoverIn = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
    }
    hoverTimerRef.current = setTimeout(() => {
      setIsHovering(true);
    }, 200); // 200ms delay to prevent quick hover triggers
  }, []);

  const handleHoverOut = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setIsHovering(false);
  }, []);

  const handleToggleCollapse = useCallback(() => {
    defaultLogger.app.page.navigationToggle();
    setAppSideBarStatus((prev) => ({
      ...prev,
      isCollapsed: !prev.isCollapsed,
    }));
    setIsHovering(false);
  }, [setAppSideBarStatus, setIsHovering]);

  useShortcuts(EShortcutEvents.SideBar, handleToggleCollapse);

  // Cleanup timer on unmount to prevent memory leak
  useEffect(
    () => () => {
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
      }
    },
    [],
  );

  return (
    <MotiView
      testID="Desktop-AppSideBar-Container"
      animate={{ width: isCollapse ? MIN_SIDEBAR_WIDTH : MAX_SIDEBAR_WIDTH }}
      transition={
        {
          duration: 200,
          type: 'timing',
        } as MotiTransition
      }
      style={{
        backgroundColor: theme.bgSidebar.val,
        paddingTop: top,
        zIndex: 2,
      }}
    >
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
      <YStack
        position="relative"
        flex={1}
        testID="Desktop-AppSideBar-Content-Container"
      >
        <MotiView
          animate={{
            width: isCollapse ? MIN_SIDEBAR_WIDTH : MAX_SIDEBAR_WIDTH,
          }}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            bottom: 0,
          }}
          transition={
            {
              duration: 120,
              type: 'timing',
            } as MotiTransition
          }
        >
          <YStack flex={1}>
            {!platformEnv.isDesktopMac && !platformEnv.isNativeIOSPad ? (
              <XStack
                ai="center"
                jc={isCollapse ? 'center' : 'flex-start'}
                px="$4"
                py="$3"
              >
                <Icon
                  name="OnekeyLogoIllus"
                  width={28}
                  height={28}
                  color="$text"
                />
                <MotiView
                  animate={{
                    opacity: isCollapse ? 0 : 1,
                    width: isCollapse ? 0 : 62,
                    marginLeft: isCollapse ? 0 : 12,
                  }}
                  transition={{
                    opacity: {
                      duration: isCollapse ? 0 : 200,
                      type: 'timing',
                      delay: isCollapse ? 0 : 100,
                    },
                    width: {
                      duration: isCollapse ? 0 : 200,
                      type: 'timing',
                    },
                    marginLeft: {
                      duration: isCollapse ? 0 : 200,
                      type: 'timing',
                    },
                  }}
                  style={{
                    overflow: 'hidden',
                  }}
                >
                  <Icon
                    name="OnekeyTextOnlyIllus"
                    width={62}
                    height={28}
                    color="$text"
                  />
                </MotiView>
              </XStack>
            ) : null}
            <YStack
              flex={1}
              pt={isCollapse ? 0 : '$3'}
              px="$3"
              alignItems={isCollapse ? 'center' : undefined}
            >
              {tabs}
            </YStack>
            <Portal name={EPortalContainerConstantName.SIDEBAR_BANNER} />
          </YStack>
        </MotiView>
      </YStack>
      <YStack
        testID="Desktop-AppSideBar-Separator"
        position="absolute"
        onHoverIn={handleHoverIn}
        onHoverOut={handleHoverOut}
        onPress={handleToggleCollapse}
        cursor="pointer"
        zIndex={1000}
        right={-8}
        top={0}
        bottom={0}
        width={16}
      >
        {isHovering ? (
          <>
            <YStack
              position="absolute"
              left={8}
              top={64}
              bottom={20}
              width={1.5}
              bg="$borderStrong"
              pointerEvents="none"
              animation="quick"
              enterStyle={{
                opacity: 0,
              }}
              opacity={1}
            />
            <YStack ai="center" jc="center" width="100%" mt="$24">
              <Tooltip
                open
                placement="right"
                renderTrigger={
                  <IconButton
                    aria-label="Toggle sidebar"
                    icon={
                      isCollapse
                        ? 'ChevronRightSmallOutline'
                        : 'ChevronLeftSmallOutline'
                    }
                    cursor="pointer"
                    size="small"
                    bg="$bgApp"
                    elevation={5}
                  />
                }
                renderContent={
                  <Tooltip.Text shortcutKey={EShortcutEvents.SideBar}>
                    {intl.formatMessage({
                      id: isCollapse
                        ? ETranslations.shortcut_expand_sidebar
                        : ETranslations.shortcut_collapse_sidebar,
                    })}
                  </Tooltip.Text>
                }
              />
            </YStack>
          </>
        ) : null}
      </YStack>
    </MotiView>
  );
}
