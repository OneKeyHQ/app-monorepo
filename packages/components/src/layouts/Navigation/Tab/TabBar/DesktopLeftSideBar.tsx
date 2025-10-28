import { useCallback, useMemo, useRef, useState } from 'react';

import { CommonActions } from '@react-navigation/native';
import { MotiView } from 'moti';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import { Tooltip } from '@onekeyhq/components/src/actions';
import type { IActionListSection } from '@onekeyhq/components/src/actions';
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
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EEnterWay } from '@onekeyhq/shared/src/logger/scopes/dex';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes/tab';
import { ETabMarketRoutes } from '@onekeyhq/shared/src/routes/tabMarket';
import { EShortcutEvents } from '@onekeyhq/shared/src/shortcuts/shortcuts.enum';
import { ESwapSource } from '@onekeyhq/shared/types/swap/types';

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
    () => (
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
  const [isHovered, setIsHovered] = useState(false);
  const showTooltipRef = useRef(isHovered);
  showTooltipRef.current = isHovered;
  const closeTooltipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showTooltipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleHoverIn = useCallback(() => {
    if (showTooltipRef.current) {
      if (closeTooltipTimer.current) {
        clearTimeout(closeTooltipTimer.current);
      }
    } else {
      showTooltipTimer.current = setTimeout(() => {
        setIsHovered(true);
      }, 250);
    }
  }, []);
  const dismissTooltip = useCallback(() => {
    setIsHovered(false);
  }, []);
  const handleHoverOut = useCallback(() => {
    if (showTooltipRef.current) {
      closeTooltipTimer.current = setTimeout(() => {
        dismissTooltip();
      }, 250);
    } else if (showTooltipTimer.current) {
      clearTimeout(showTooltipTimer.current);
    }
  }, [dismissTooltip]);

  const routeNames = useMemo(() => {
    return routes.map((route) => route.name);
  }, [routes]);

  const focusRouteName = useMemo(() => {
    return state.routes[state.index].name;
  }, [state.routes, state.index]);

  const isFocusedRouteNames = useMemo(() => {
    return routeNames.includes(focusRouteName);
  }, [routeNames, focusRouteName]);

  const routesElements = useMemo(() => {
    return routes.map((route) => {
      const focus = focusRouteName === route.name;
      const { options } = descriptors[route.key] as {
        options: {
          tabbarOnPress?: () => void;
        };
      };
      const onPress = () => {
        const event = navigation.emit({
          type: 'tabPress',
          target: route.key,
          canPreventDefault: true,
        });
        if (!focus && !event.defaultPrevented) {
          navigation.dispatch({
            ...CommonActions.navigate({
              name: route.name,
              merge: true,
              params:
                route.name === ETabRoutes.Market
                  ? {
                      screen: ETabMarketRoutes.TabMarket,
                      params: { from: EEnterWay.HomeTab },
                    }
                  : undefined,
            }),
            target: state.key,
          });
        }
      };

      return (
        <TabItemView
          key={route.key}
          route={route}
          onPress={onPress}
          onPressOut={dismissTooltip}
          isActive={focus}
          options={options}
          isCollapse={false}
        />
      );
    });
  }, [
    routes,
    focusRouteName,
    descriptors,
    dismissTooltip,
    navigation,
    state.key,
  ]);

  return (
    <Tooltip
      open={isHovered}
      placement="right-start"
      renderTrigger={
        <YStack
          userSelect="none"
          gap="$0.5"
          py="$1.5"
          onHoverIn={handleHoverIn}
          onHoverOut={handleHoverOut}
        >
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
        <YStack
          pt="$1"
          pb="$2"
          minWidth={240}
          onHoverIn={handleHoverIn}
          onHoverOut={handleHoverOut}
        >
          <SizableText size="$headingMd" p="$2">
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

  const isShowWebTabBar = platformEnv.isDesktop || platformEnv.isNativeIOS;

  const routesNotHidden = useMemo(() => {
    return routes.filter((route) => {
      const { options } = descriptors[route.key] as {
        options: {
          hidden?: boolean;
        };
      };
      return !options.hidden;
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
          navigation.dispatch({
            ...CommonActions.navigate({
              name: route.name,
              merge: true,
              params:
                route.name === ETabRoutes.Market
                  ? {
                      screen: ETabMarketRoutes.TabMarket,
                      params: { from: EEnterWay.HomeTab },
                    }
                  : undefined,
            }),
            target: state.key,
          });
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

  const handleToggleCollapse = useCallback(() => {
    defaultLogger.app.page.navigationToggle();
    setAppSideBarStatus((prev) => ({
      ...prev,
      isCollapsed: !prev.isCollapsed,
    }));
    setIsHovering(false);
  }, [setAppSideBarStatus, setIsHovering]);

  useShortcuts(EShortcutEvents.SideBar, handleToggleCollapse);

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
        borderRightColor: theme.neutral4.val,
        borderRightWidth: StyleSheet.hairlineWidth,
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
        onHoverIn={() => {
          setIsHovering(true);
        }}
        onHoverOut={() => {
          setIsHovering(false);
        }}
        zIndex={1000}
        right={-8}
        top={0}
        bottom={0}
        width={16}
        ai="center"
        jc="center"
      >
        {isHovering ? (
          <MotiView
            from={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={
              {
                type: 'timing',
                duration: 200,
              } as MotiTransition
            }
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              paddingBottom: 96,
            }}
          >
            <Tooltip
              placement="right"
              renderTrigger={
                <YStack
                  aria-label="Toggle sidebar"
                  role="button"
                  height="$20"
                  width="$5"
                  ai="center"
                  jc="center"
                  cursor={isCollapse ? 'e-resize' : 'w-resize'}
                  onPress={handleToggleCollapse}
                >
                  <YStack
                    height="$16"
                    width="$2"
                    bg="$neutral6"
                    hoverStyle={{
                      bg: '$neutral8',
                    }}
                    borderRadius="$full"
                    pointerEvents="none"
                  />
                </YStack>
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
          </MotiView>
        ) : null}
      </YStack>
    </MotiView>
  );
}
