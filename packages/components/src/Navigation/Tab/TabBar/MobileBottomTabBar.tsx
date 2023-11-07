import { useMemo } from 'react';

import useIsKeyboardShown from '@react-navigation/bottom-tabs/src/utils/useIsKeyboardShown';
import { CommonActions } from '@react-navigation/native';
import { StyleSheet } from 'react-native';

import useSafeAreaInsets from '../../../Provider/hooks/useSafeAreaInsets';
import { Stack } from '../../../Stack';

import { TabItem } from './TabItem';

import type { ICON_NAMES } from '../../../Icon';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs/src/types';
import type { Animated, StyleProp, ViewStyle } from 'react-native';

export type MobileBottomTabBarProps = BottomTabBarProps & {
  backgroundColor?: string;
  style?: Animated.WithAnimatedValue<StyleProp<ViewStyle>>;
};

export default function MobileBottomTabBar({
  navigation,
  state,
  descriptors,
}: MobileBottomTabBarProps) {
  const isKeyboardShown = useIsKeyboardShown();
  const { routes } = state;
  const { bottom } = useSafeAreaInsets();

  const isHide = isKeyboardShown;

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

        const renderItemContent = (renderActive: boolean) => (
          <TabItem
            testID="Mobile-AppTabBar-TabItem-Icon"
            // @ts-expect-error
            icon={options?.tabBarIcon?.(renderActive) as ICON_NAMES}
            label={options?.tabBarLabel as string}
            style={[StyleSheet.absoluteFill]}
            selected={renderActive}
            {...(!(isActive === renderActive) && {
              opacity: 0,
            })}
          />
        );

        return (
          <Stack
            testID="Mobile-AppTabBar-TabItem"
            flex={1}
            key={route.name}
            onPress={onPress}
          >
            {renderItemContent(false)}
            {renderItemContent(true)}
          </Stack>
        );
      }),
    [descriptors, navigation, routes, state.index, state.key],
  );
  if (isHide) {
    return null;
  }
  return (
    <Stack
      testID="Mobile-AppTabBar"
      borderTopWidth={StyleSheet.hairlineWidth}
      bg="$bgApp"
      borderTopColor="$borderSubdued"
      pb={bottom}
    >
      <Stack
        testID="Mobile-AppTabBar-Content"
        accessibilityRole="tablist"
        flexDirection="row"
        justifyContent="space-around"
        h={54}
      >
        {tabs}
      </Stack>
    </Stack>
  );
}
