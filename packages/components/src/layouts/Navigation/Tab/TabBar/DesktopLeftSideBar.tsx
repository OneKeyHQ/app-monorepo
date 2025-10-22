import { useMemo, useState } from 'react';

import { CommonActions } from '@react-navigation/native';
import { MotiView } from 'moti';
import { StyleSheet } from 'react-native';

import {
  type IActionListSection,
  IconButton,
} from '@onekeyhq/components/src/actions';
import { OneKeyLogo } from '@onekeyhq/components/src/content';
import {
  EPortalContainerConstantName,
  Portal,
} from '@onekeyhq/components/src/hocs';
import { useSafeAreaInsets } from '@onekeyhq/components/src/hooks';
import type { IKeyOfIcons } from '@onekeyhq/components/src/primitives';
import {
  Icon,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components/src/primitives';
import { useMedia, useTheme } from '@onekeyhq/components/src/shared/tamagui';
import {
  MAX_SIDEBAR_WIDTH,
  MIN_SIDEBAR_WIDTH,
} from '@onekeyhq/components/src/utils/sidebar';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { useAppSideBarStatusAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/settings';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EEnterWay } from '@onekeyhq/shared/src/logger/scopes/dex';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes/tab';
import { ETabMarketRoutes } from '@onekeyhq/shared/src/routes/tabMarket';
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
  isCollapse,
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

  const contentMemo = useMemo(
    () => (
      <YStack
        ai={isCollapse ? 'center' : undefined}
        gap={isCollapse ? '$1' : undefined}
        py={isCollapse ? 5 : undefined}
        onPress={options.tabbarOnPress ?? onPress}
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
          onPress={options.tabbarOnPress ?? onPress}
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
          <SizableText size="$bodySmMedium" textAlign="center">
            {options.collapseTabBarLabel ?? options.tabBarLabel ?? route.name}
          </SizableText>
        ) : null}
      </YStack>
    ),
    [isActive, isCollapse, isContainerHovered, onPress, options, route.name],
  );

  return contentMemo;
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
  const [{ collapsed: isCollapse }, setAppSideBarStatus] =
    useAppSideBarStatusAtom();
  const { top } = useSafeAreaInsets(); // used for ipad
  const theme = useTheme();
  const [isHovering, setIsHovering] = useState(false);

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
              <XStack ai="center" jc="space-between" pr="$3">
                <OneKeyLogo />
                <HeaderCollapseButton isRootScreen />
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
      {isCollapse ? (
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
          right={-2}
          top={0}
          bottom={0}
          width={4}
          ai="center"
          jc="center"
        >
          {isHovering ? (
            <IconButton
              onPress={() => {
                setAppSideBarStatus((prev) => ({ ...prev, collapsed: false }));
              }}
              icon="ChevronRightSmallOutline"
              size="large"
              iconProps={{
                color: '$iconSubdued',
              }}
            />
          ) : null}
        </YStack>
      ) : null}
    </MotiView>
  );
}
