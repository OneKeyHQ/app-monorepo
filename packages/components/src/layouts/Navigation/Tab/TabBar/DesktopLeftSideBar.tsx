import { useMemo } from 'react';

import { CommonActions } from '@react-navigation/native';
import { MotiView } from 'moti';
import { StyleSheet } from 'react-native';
import { getTokens, useMedia, useTheme } from 'tamagui';

import { type IActionListSection } from '@onekeyhq/components/src/actions';
import {
  EPortalContainerConstantName,
  Portal,
} from '@onekeyhq/components/src/hocs';
import useProviderSideBarValue from '@onekeyhq/components/src/hocs/Provider/hooks/useProviderSideBarValue';
import { useSafeAreaInsets } from '@onekeyhq/components/src/hooks';
import type { IKeyOfIcons } from '@onekeyhq/components/src/primitives';
import { Icon, XStack, YStack } from '@onekeyhq/components/src/primitives';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { type EShortcutEvents } from '@onekeyhq/shared/src/shortcuts/shortcuts.enum';
import { ESwapSource } from '@onekeyhq/shared/types/swap/types';

import HeaderCollapseButton from '../../Header/HeaderCollapseButton';

import { DesktopTabItem } from './DesktopTabItem';

import type { ITabNavigatorExtraConfig } from '../../Navigator/types';
import type {
  BottomTabBarProps,
  BottomTabNavigationOptions,
} from '@react-navigation/bottom-tabs';
import type { NavigationState } from '@react-navigation/routers';
import type { MotiTransition } from 'moti';

function TabItemView({
  isActive,
  route,
  onPress,
  options,
}: {
  isActive: boolean;
  route: NavigationState['routes'][0];
  onPress: () => void;
  options: BottomTabNavigationOptions & {
    actionList?: IActionListSection[];
    shortcutKey?: EShortcutEvents;
    tabbarOnPress?: () => void;
    onPressWhenSelected?: () => void;
    trackId?: string;
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

  const contentMemo = useMemo(
    () => (
      <DesktopTabItem
        onPress={options.tabbarOnPress ?? onPress}
        onPressWhenSelected={options.onPressWhenSelected}
        trackId={options.trackId}
        aria-current={isActive ? 'page' : undefined}
        selected={isActive}
        shortcutKey={options.shortcutKey}
        tabBarStyle={options.tabBarStyle}
        // @ts-expect-error
        icon={options?.tabBarIcon?.(isActive) as IKeyOfIcons}
        label={(options.tabBarLabel ?? route.name) as string}
        actionList={options.actionList}
        testID={route.name.toLowerCase()}
      />
    ),
    [isActive, onPress, options, route.name],
  );

  return contentMemo;
}

function OneKeyLogo() {
  return (
    <XStack px="$4" py="$3">
      <Icon name="OnekeyTextIllus" width={101} height={28} color="$text" />
    </XStack>
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
  const { routes } = state;
  const { leftSidebarCollapsed: isCollapse } = useProviderSideBarValue();
  const { top } = useSafeAreaInsets(); // used for ipad
  const theme = useTheme();
  const getSizeTokens = getTokens().size;

  const sidebarWidth = getSizeTokens.sideBarWidth.val;

  const { gtMd } = useMedia();
  const isShowWebTabBar = platformEnv.isDesktop || platformEnv.isNativeIOS;

  const tabs = useMemo(
    () =>
      routes.map((route, index) => {
        const focus = index === state.index;
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
              }),
              target: state.key,
            });
          }
        };

        if (isShowWebTabBar && gtMd && route.name === extraConfig?.name) {
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
      }),
    [
      routes,
      state.index,
      state.key,
      descriptors,
      isShowWebTabBar,
      gtMd,
      extraConfig?.name,
      isCollapse,
      navigation,
    ],
  );

  return (
    <MotiView
      testID="Desktop-AppSideBar-Container"
      animate={{ width: isCollapse ? 0 : sidebarWidth }}
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
        borderRightWidth: isCollapse ? 0 : StyleSheet.hairlineWidth,
        overflow: 'hidden',
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
        >
          <HeaderCollapseButton isRootScreen hideWhenCollapse />
        </XStack>
      ) : null}
      <YStack
        position="relative"
        flex={1}
        testID="Desktop-AppSideBar-Content-Container"
      >
        <MotiView
          animate={{ left: isCollapse ? -sidebarWidth : 0 }}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: sidebarWidth,
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
              <XStack ai="center" jc="space-between" pr="$3">
                <OneKeyLogo />
                <HeaderCollapseButton isRootScreen />
              </XStack>
            ) : null}
            <YStack flex={1} pt="$3" px="$3">
              {tabs}
            </YStack>
            <Portal name={EPortalContainerConstantName.SIDEBAR_BANNER} />
          </YStack>
        </MotiView>
      </YStack>
    </MotiView>
  );
}
