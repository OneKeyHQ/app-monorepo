import type { FC } from 'react';
import { useContext, useMemo } from 'react';

import getDefaultHeaderHeight from '@react-navigation/elements/src/Header/getDefaultHeaderHeight';
import { CommonActions } from '@react-navigation/native';
import { AnimatePresence, MotiView } from 'moti';
import { StyleSheet } from 'react-native';
import { useSafeAreaFrame } from 'react-native-safe-area-context';
import { ScrollView, Tooltip } from 'tamagui';

import {
  Icon,
  Stack,
  Text,
  YStack,
  getThemeTokens,
  useThemeValue,
} from '@onekeyhq/components';
import { DesktopDragZoneAbsoluteBar } from '@onekeyhq/components/src/DesktopDragZoneBox';
import { Context } from '@onekeyhq/components/src/Provider/hooks/useProviderValue';
import useSafeAreaInsets from '@onekeyhq/components/src/Provider/hooks/useSafeAreaInsets';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { ICON_NAMES } from '../../../Icon';
import type {
  BottomTabBarProps,
  BottomTabNavigationOptions,
} from '@react-navigation/bottom-tabs/src/types';
import type { NavigationState } from '@react-navigation/routers/src/types';
import useProviderSideBarValue from '../../../Provider/hooks/useProviderSideBarValue';

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
        px={touchMode ? '$2.5' : '$1.5'}
        py={touchMode ? '$3' : '$2'}
        borderRadius="$2"
        backgroundColor={isActive ? '$bgActive' : undefined}
        hoverStyle={!isActive ? { backgroundColor: '$bgHover' } : undefined}
        aria-current={isActive ? 'page' : undefined}
      >
        <Stack>
          <Icon
            // @ts-expect-error
            name={options?.tabBarIcon?.(isActive) as ICON_NAMES}
            color={isActive ? '$icon' : '$iconSubdued'}
            size={touchMode ? '$6' : '$5'}
          />
        </Stack>

        <AnimatePresence initial={false}>
          {!isCollapse && (
            <MotiView
              from={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{
                opacity: 0,
              }}
              transition={{
                type: 'timing',
                duration: 150,
              }}
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              <Text
                variant={touchMode ? '$bodyLg' : '$bodyMd'}
                flex={1}
                marginLeft="$1"
                color={isActive ? '$text' : '$textSubdued'}
                numberOfLines={1}
                // isTruncated
              >
                {options.tabBarLabel ?? route.name}
              </Text>
            </MotiView>
          )}
        </AnimatePresence>
      </Stack>
    ),
    [isActive, isCollapse, onPress, options, route.name, touchMode],
  );

  if (!isCollapse) {
    return contentMemo;
  }

  return (
    <Tooltip key={route.key} placement="right">
      <Tooltip.Trigger>{contentMemo}</Tooltip.Trigger>
      <Tooltip.Content
        enterStyle={{ x: 0, y: -5, opacity: 0, scale: 0.9 }}
        exitStyle={{ x: 0, y: -5, opacity: 0, scale: 0.9 }}
        scale={1}
        x={0}
        y={0}
        opacity={1}
        animation={[
          'fast',
          {
            opacity: {
              overshootClamping: true,
            },
          },
        ]}
      >
        <Tooltip.Arrow />
        <Text variant="$bodyMd">{options.tabBarLabel}</Text>
      </Tooltip.Content>
    </Tooltip>
  );
}

const Sidebar: FC<BottomTabBarProps> = ({ navigation, state, descriptors }) => {
  const { routes } = state;
  const { leftSidebarCollapsed: isCollapse } = useProviderSideBarValue();
  const { top } = useSafeAreaInsets(); // used for ipad
  const frame = useSafeAreaFrame();

  // iPad and Android tablet
  const touchMode = platformEnv.isNativeIOSPad || platformEnv.isNativeAndroid;

  const tokens = getThemeTokens().size;
  const touchValues = {
    slideBarWidth: tokens['60'].val,
    slideBarCollapseWidth: 78,
    slideBarPadding: tokens['4'].val,
  };

  const nonTouchValues = {
    slideBarWidth: tokens['52'].val,
    slideBarCollapseWidth: 58,
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

  const [slideBg, slideBorder] = useThemeValue(['bgSubdued', 'borderSubdued']);

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

  return (
    <MotiView
      animate={{ width: isCollapse ? slideBarCollapseWidth : slideBarWidth }}
      transition={{
        type: 'timing',
        duration: 150,
      }}
      // @ts-expect-error
      style={{
        height: '100%',
        width: slideBarWidth,
        backgroundColor: slideBg,
        paddingHorizontal: slideBarPadding,
        paddingTop: paddingTopValue,
        paddingBottom: slideBarPadding,
        borderRightColor: slideBorder,
        borderRightWidth: StyleSheet.hairlineWidth,
      }}
      testID="Desktop-AppSideBar-Container"
    >
      <DesktopDragZoneAbsoluteBar
        testID="Desktop-AppSideBar-DragZone"
        h={dragZoneAbsoluteBarHeight}
      />
      {/* Scrollable area */}
      {/* <Box zIndex={1} testID="Desktop-AppSideBar-WalletSelector-Container"> */}
      {/*  /!* <AccountSelector /> *!/ */}
      {/*  <WalletSelectorTrigger showWalletName={!isCollpase} /> */}
      {/* </Box> */}
      <YStack
        testID="Desktop-AppSideBar-Content-Container"
        flex={1}
        marginTop="$1"
        marginBottom="$0.5"
      >
        <ScrollView flex={1}>
          <YStack flex={1}>{tabs}</YStack>
        </ScrollView>
      </YStack>
      {/* <Box testID="Legacy-Desktop-AppSideBar-NetworkAccountSelector-Container"> */}
      {/*  /!* <ChainSelector /> *!/ */}
      {/*  <NetworkAccountSelectorTrigger /> */}
      {/* </Box> */}
    </MotiView>
  );
};
export default Sidebar;
