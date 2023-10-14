/* eslint-disable no-nested-ternary */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { useMemo } from 'react';

import useIsKeyboardShown from '@react-navigation/bottom-tabs/src/utils/useIsKeyboardShown';
import { CommonActions } from '@react-navigation/native';
import { Platform, StyleSheet } from 'react-native';
import { useSafeAreaFrame } from 'react-native-safe-area-context';

import { Icon } from '../../../Icon';
import useDeviceScreenSize from '../../../Provider/hooks/useDeviceScreenSize';
import { Stack } from '../../../Stack';
import { Text } from '../../../Text';

import type { ICON_NAMES } from '../../../Icon';
import type { DeviceScreenSize } from '../../../Provider/device';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs/src/types';
import type { Animated, StyleProp, ViewStyle } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';

const DEFAULT_TABBAR_HEIGHT = 63;
const COMPACT_TABBAR_HEIGHT = 40;
const COMPACT_PAD_TABBAR_HEIGHT = 54;

type Options = {
  deviceSize: DeviceScreenSize;
  dimensions?: { height: number; width: number };
};

const shouldUseHorizontalLabels = ({ deviceSize }: Options) =>
  ['NORMAL'].includes(deviceSize);

const getPaddingBottom = (insets: EdgeInsets) => insets.bottom;

export const getTabBarHeight = ({
  insets,
  style,
}: Options & {
  insets: EdgeInsets;
  style: Animated.WithAnimatedValue<StyleProp<ViewStyle>> | undefined;
}) => {
  // @ts-ignore
  const customHeight = StyleSheet.flatten(style)?.height;

  if (typeof customHeight === 'number' && customHeight > 0) {
    return customHeight;
  }
  const paddingBottom = getPaddingBottom(insets);

  if (Platform.OS === 'ios' && !Platform.isPad) {
    return COMPACT_TABBAR_HEIGHT + paddingBottom;
  }
  if (Platform.OS === 'ios' && Platform.isPad) {
    return COMPACT_PAD_TABBAR_HEIGHT + paddingBottom;
  }

  return DEFAULT_TABBAR_HEIGHT + paddingBottom;
};

export type MobileBottomTabBarProps = BottomTabBarProps & {
  backgroundColor?: string;
  style?: Animated.WithAnimatedValue<StyleProp<ViewStyle>>;
};

export default function MobileBottomTabBar({
  navigation,
  state,
  descriptors,
  backgroundColor,
  insets,
  style,
}: MobileBottomTabBarProps) {
  const size = useDeviceScreenSize();

  console.log('=====>>>>> size', insets);

  const dimensions = useSafeAreaFrame();
  const isKeyboardShown = useIsKeyboardShown();
  const { routes } = state;

  const isHide = isKeyboardShown;

  const focusedRoute = state.routes[state.index];
  const focusedDescriptor = descriptors[focusedRoute.key];
  const focusedOptions = focusedDescriptor.options;

  const { tabBarStyle } = focusedOptions;

  const tabBarHeight = getTabBarHeight({
    insets,
    dimensions,
    deviceSize: size,
    style: [tabBarStyle, style],
  });

  const horizontal = shouldUseHorizontalLabels({
    deviceSize: size,
  });

  const tabs = useMemo(
    () =>
      routes.map((route, index) => {
        const isActive = index === state.index;
        const { options } = descriptors[route.key];

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isActive && !event.defaultPrevented) {
            navigation.dispatch({
              ...CommonActions.navigate({ name: route.name, merge: true }),
              target: state.key,
            });
          }
        };

        return (
          <Stack
            testID="Mobile-AppTabBar-TabItem"
            minWidth="$24"
            p="$1"
            key={route.name}
            backgroundColor={backgroundColor}
          >
            <Stack
              testID="Mobile-AppTabBar-TabItem-Icon"
              alignItems="center"
              py="$0.5"
              mb="$0"
              gap="$0.5"
              onPress={onPress}
              hoverStyle={{ backgroundColor: '$bgHover' }}
              borderRadius="$2"
              justifyContent="center"
              key={route.name}
              style={
                horizontal
                  ? {
                      flexDirection: 'row',
                    }
                  : {
                      flexDirection: 'column',
                    }
              }
            >
              <Icon
                // @ts-expect-error
                name={options?.tabBarIcon?.(isActive) as ICON_NAMES}
                color={isActive ? '$icon' : '$iconSubdued'}
                size="$7"
              />
              {options?.tabBarLabel?.length ? (
                <Text
                  variant="$bodySmMedium"
                  color={isActive ? '$text' : '$textSubdued'}
                  numberOfLines={1}
                >
                  {options?.tabBarLabel}
                </Text>
              ) : null}
            </Stack>
          </Stack>
        );
      }),
    [
      backgroundColor,
      descriptors,
      horizontal,
      navigation,
      routes,
      state.index,
      state.key,
    ],
  );
  if (isHide) {
    return null;
  }
  return (
    <Stack
      testID="Mobile-AppTabBar"
      borderTopWidth={StyleSheet.hairlineWidth}
      left="$0"
      right="$0"
      bottom="$0"
      bg="$bg"
      borderTopColor="$borderSubdued"
      height={tabBarHeight}
      py="$0"
    >
      <Stack
        testID="Mobile-AppTabBar-Content"
        accessibilityRole="tablist"
        flex={1}
        alignItems="baseline"
        justifyContent="space-around"
        flexDirection="row"
      >
        {tabs}
      </Stack>
    </Stack>
  );
}
