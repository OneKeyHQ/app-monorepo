import type { FC } from 'react';
import { useMemo } from 'react';

import getDefaultHeaderHeight from '@react-navigation/elements/src/Header/getDefaultHeaderHeight';
import { CommonActions } from '@react-navigation/native';
import { MotiView } from 'moti';
import { StyleSheet } from 'react-native';
import { useSafeAreaFrame } from 'react-native-safe-area-context';
import { ScrollView } from 'tamagui';

import {
  Icon,
  Portal,
  Stack,
  Text,
  YStack,
  getThemeTokens,
  useThemeValue,
} from '@onekeyhq/components';
import { DesktopDragZoneAbsoluteBar } from '@onekeyhq/components/src/DesktopDragZoneBox';
import useSafeAreaInsets from '@onekeyhq/components/src/Provider/hooks/useSafeAreaInsets';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import useProviderSideBarValue from '../../../Provider/hooks/useProviderSideBarValue';

import type { ICON_NAMES } from '../../../Icon';
import type {
  BottomTabBarProps,
  BottomTabNavigationOptions,
} from '@react-navigation/bottom-tabs/src/types';
import type { NavigationState } from '@react-navigation/routers/src/types';

function TabItemView({
  isActive,
  touchMode,
  isCollapse,
  route,
  onPress,
  options,
}: {
  isActive: boolean;
  touchMode: boolean | undefined;
  route: NavigationState['routes'][0];
  onPress: () => void;
  options: BottomTabNavigationOptions;
  isCollapse?: boolean;
}) {
  const contentMemo = useMemo(
    () => (
      <Stack
        onPress={onPress}
        flexDirection="row"
        alignItems="center"
        px={touchMode ? '$3' : '$2'}
        py={touchMode ? '$2.5' : '$1.5'}
        borderRadius="$2"
        backgroundColor={isActive ? '$bgActive' : undefined}
        hoverStyle={!isActive ? { backgroundColor: '$bgHover' } : undefined}
        aria-current={isActive ? 'page' : undefined}
      >
        <Stack>
          <Icon
            // @ts-expect-error
            name={options?.tabBarIcon?.(isActive) as ICON_NAMES}
            color="$iconSubdued"
            size={touchMode ? '$6' : '$5'}
          />
        </Stack>

        {!isCollapse && (
          <Text
            variant={touchMode ? '$bodyLg' : '$bodyMd'}
            flex={1}
            marginLeft="$2"
            color="$text"
            numberOfLines={1}
          >
            {options.tabBarLabel ?? route.name}
          </Text>
        )}
      </Stack>
    ),
    [isActive, isCollapse, onPress, options, route.name, touchMode],
  );

  return contentMemo;
}

export function DesktopLeftSideBar({
  navigation,
  state,
  descriptors,
}: BottomTabBarProps) {
  const { routes } = state;
  const { leftSidebarCollapsed: isCollapse } = useProviderSideBarValue();
  const { top } = useSafeAreaInsets(); // used for ipad
  const frame = useSafeAreaFrame();

  // iPad and Android tablet
  const touchMode = platformEnv.isNativeIOSPad || platformEnv.isNativeAndroid;

  const tokens = getThemeTokens().size;
  const touchValues = {
    slideBarWidth: tokens['60'].val,
    slideBarCollapseWidth: 0, // 78,
    slideBarPadding: tokens['4'].val,
  };

  const nonTouchValues = {
    slideBarWidth: tokens['52'].val,
    slideBarCollapseWidth: 0, // 58,
    slideBarPadding: tokens['3'].val,
  };

  const { slideBarWidth, slideBarCollapseWidth, slideBarPadding } = touchMode
    ? touchValues
    : nonTouchValues;
  const dragZoneAbsoluteBarHeight = platformEnv.isDesktopMac ? 36 : 0; // used for desktop

  const defaultHeight = getDefaultHeaderHeight(frame, false, top);
  const disExtraPaddingTop = platformEnv.isWeb || touchMode;
  const paddingTopValue =
    slideBarPadding + top + (disExtraPaddingTop ? 0 : defaultHeight);

  const [slideBg, slideBorder] = useThemeValue(['bgSidebar', 'borderSubdued']);

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

        return (
          <TabItemView
            touchMode={touchMode}
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
      descriptors,
      isCollapse,
      navigation,
      routes,
      state.index,
      state.key,
      touchMode,
    ],
  );

  const customTab = platformEnv.isDesktop ? (
    <YStack
      onPress={() => {
        navigation.dispatch({
          ...CommonActions.navigate({
            name: route.name,
            merge: true,
          }),
          target: state.key,
        });
      }}
    >
      <Portal.Container name={Portal.Constant.WEB_TAB_BAR} />
    </YStack>
  ) : null;
  return (
    <MotiView
      animate={{ width: isCollapse ? slideBarCollapseWidth : slideBarWidth }}
      transition={{
        type: 'timing',
        duration: 150,
      }}
      style={{
        height: '100%',
        width: slideBarWidth,
        backgroundColor: slideBg,
        paddingTop: paddingTopValue,
        borderRightColor: slideBorder,
        borderRightWidth: isCollapse ? 0 : StyleSheet.hairlineWidth,
      }}
      testID="Desktop-AppSideBar-Container"
    >
      <DesktopDragZoneAbsoluteBar
        testID="Desktop-AppSideBar-DragZone"
        h={dragZoneAbsoluteBarHeight}
      />
      <YStack
        testID="Desktop-AppSideBar-Content-Container"
        flex={1}
        marginTop="$1"
        marginBottom={touchMode ? '$4' : '$3'}
        marginHorizontal={touchMode ? '$4' : '$3'}
      >
        <ScrollView flex={1}>
          <YStack flex={1}>
            {tabs}
            {customTab}
          </YStack>
        </ScrollView>
      </YStack>
    </MotiView>
  );
}
