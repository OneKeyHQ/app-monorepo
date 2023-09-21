import type { FC } from 'react';
import { useContext, useMemo } from 'react';

import getDefaultHeaderHeight from '@react-navigation/elements/src/Header/getDefaultHeaderHeight';
import { CommonActions } from '@react-navigation/native';
import { AnimatePresence, MotiView } from 'moti';
import { useSafeAreaFrame } from 'react-native-safe-area-context';
import { ScrollView, Tooltip, YStack } from 'tamagui';

import { Icon, Stack, Text, useThemeValue } from '@onekeyhq/components';
import { DesktopDragZoneAbsoluteBar } from '@onekeyhq/components/src/DesktopDragZoneBox';
import { Context } from '@onekeyhq/components/src/Provider/hooks/useProviderValue';
import useSafeAreaInsets from '@onekeyhq/components/src/Provider/hooks/useSafeAreaInsets';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { ICON_NAMES } from '../../../Icon';
import type {
  BottomTabBarProps,
  BottomTabNavigationOptions,
} from '../BottomTabs';
import type { NavigationState } from '@react-navigation/routers/src/types';

function TabItemView({
  isActive,
  isCollpase,
  route,
  onPress,
  options,
}: {
  isActive: boolean;
  route: NavigationState['routes'][0];
  onPress: () => void;
  options: BottomTabNavigationOptions;
  isCollpase?: boolean;
}) {
  const contentMemo = useMemo(
    () => (
      <Stack
        onPress={onPress}
        flexDirection="row"
        alignItems="center"
        px="$2.5"
        py="$3"
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
          />
        </Stack>

        <AnimatePresence initial={false}>
          {!isCollpase && (
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
                variant="$bodyLg"
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
    [isActive, isCollpase, onPress, options, route.name],
  );

  if (!isCollpase) {
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
  const { leftSidebarCollapsed: isCollpase } = useContext(Context);
  const { top } = useSafeAreaInsets(); // used for ipad
  const frame = useSafeAreaFrame();

  const dragZoneAbsoluteBarHeight = platformEnv.isDesktopMac ? 36 : 0; // used for desktop
  const slideBarWidth = 240;
  const slideBarPadding = 16;

  const defaultHeight = getDefaultHeaderHeight(frame, false, top);
  const disExtraPaddingTop = platformEnv.isWeb || platformEnv.isNativeIOSPad;
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
            key={route.key}
            route={route}
            onPress={onPress}
            isActive={focus}
            options={options}
            isCollpase={isCollpase}
          />
        );
      }),
    [descriptors, isCollpase, navigation, routes, state.index, state.key],
  );

  return (
    <MotiView
      animate={{ width: isCollpase ? 80 : slideBarWidth }}
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
        borderRightWidth: 0.3,
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
