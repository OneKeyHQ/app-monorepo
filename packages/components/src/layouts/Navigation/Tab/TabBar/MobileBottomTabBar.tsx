import { useCallback, useEffect, useMemo } from 'react';

import { CommonActions } from '@react-navigation/native';
import { Animated, StyleSheet } from 'react-native';
import { useThrottledCallback } from 'use-debounce';

import { useSafeAreaInsets } from '@onekeyhq/components/src/hooks';
import { Stack } from '@onekeyhq/components/src/primitives';
import type { IKeyOfIcons } from '@onekeyhq/components/src/primitives';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ESwapSource } from '@onekeyhq/shared/types/swap/types';

import { MobileTabItem } from './MobileTabItem';

import type { ITabNavigatorExtraConfig } from '../../Navigator/types';
import type {
  BottomTabBarProps,
  BottomTabNavigationOptions,
} from '@react-navigation/bottom-tabs';
import type { RouteProp } from '@react-navigation/native';
import type { StyleProp, ViewStyle } from 'react-native';

export type IMobileBottomTabBarProps = BottomTabBarProps & {
  backgroundColor?: string;
  style?: Animated.WithAnimatedValue<StyleProp<ViewStyle>>;
  trackId?: string;
};

export default function MobileBottomTabBar({
  navigation,
  state,
  descriptors,
  extraConfig,
}: IMobileBottomTabBarProps & {
  extraConfig?: ITabNavigatorExtraConfig<string>;
}) {
  const { routes } = state;
  const { bottom } = useSafeAreaInsets();

  const heightAnim = useMemo(() => new Animated.Value(54), []);
  const opacityAnim = useMemo(() => new Animated.Value(1), []);

  useEffect(() => {
    appEventBus.on(EAppEventBusNames.HideTabBar, (hide) => {
      Animated.parallel([
        Animated.timing(heightAnim, {
          toValue: hide ? 0 : 54,
          duration: 250,
          useNativeDriver: false,
        }),
        Animated.timing(opacityAnim, {
          toValue: hide ? 0 : 1,
          duration: 250,
          useNativeDriver: false,
        }),
      ]).start();
    });
  }, [heightAnim, opacityAnim]);

  const onTabPress = useCallback(
    (
      route: RouteProp<Record<string, object | undefined>, string>,
      isActive: boolean,
      options: BottomTabNavigationOptions,
    ) => {
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
      if (!isActive && !event.defaultPrevented) {
        navigation.dispatch({
          ...CommonActions.navigate({ name: route.name, merge: true }),
          target: state.key,
        });
      }
      const trackId = (options as { trackId?: string })?.trackId;
      if (trackId) {
        defaultLogger.app.page.tabBarClick(trackId);
      }
    },
    [navigation, state.key],
  );
  const onDebouncedTabPress = useThrottledCallback(onTabPress, 250);
  const handleRoutePress = platformEnv.isNativeAndroid
    ? onDebouncedTabPress
    : onTabPress;

  const tabs = useMemo(
    () =>
      routes.map((route, index) => {
        const isActive = index === state.index;
        const { options } = descriptors[route.key];

        if (route.name === extraConfig?.name) {
          return null;
        }

        const onPress = () => {
          handleRoutePress(route, isActive, options);
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
    [descriptors, extraConfig?.name, handleRoutePress, routes, state.index],
  );
  return (
    <Stack
      testID="Mobile-AppTabBar"
      borderTopWidth={StyleSheet.hairlineWidth}
      bg="$bgApp"
      borderTopColor="$borderSubdued"
      pb={bottom}
    >
      <Animated.View
        style={{
          height: heightAnim,
          opacity: opacityAnim,
          flexDirection: 'row',
          justifyContent: 'space-around',
        }}
      >
        {tabs}
      </Animated.View>
    </Stack>
  );
}
