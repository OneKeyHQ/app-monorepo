import { useMemo } from 'react';

import { CommonActions } from '@react-navigation/native';
import { StyleSheet } from 'react-native';

import { useSafeAreaInsets } from '@onekeyhq/components/src/hooks';
import { Stack } from '@onekeyhq/components/src/primitives';
import type { IKeyOfIcons } from '@onekeyhq/components/src/primitives';

import { MobileTabItem } from './MobileTabItem';

import type { BottomTabBarProps } from '@react-navigation/bottom-tabs/src/types';
import type { Animated, StyleProp, ViewStyle } from 'react-native';

export type IMobileBottomTabBarProps = BottomTabBarProps & {
  backgroundColor?: string;
  style?: Animated.WithAnimatedValue<StyleProp<ViewStyle>>;
};

export default function MobileBottomTabBar({
  navigation,
  state,
  descriptors,
}: IMobileBottomTabBarProps) {
  // const isKeyboardShown = useIsKeyboardShown();
  const { routes } = state;
  const { bottom } = useSafeAreaInsets();

  // const isHide = isKeyboardShown;

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
          <MobileTabItem
            testID="Mobile-AppTabBar-TabItem-Icon"
            // @ts-expect-error
            icon={options?.tabBarIcon?.(renderActive) as IKeyOfIcons}
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
            testID={route.name.toLowerCase()}
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
