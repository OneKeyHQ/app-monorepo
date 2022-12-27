/* eslint-disable no-nested-ternary */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { useMemo } from 'react';

import { CommonActions } from '@react-navigation/native';
import { Platform, StyleSheet } from 'react-native';

import { useSafeAreaInsets, useUserDevice } from '@onekeyhq/components';
import { PortalExit } from '@onekeyhq/kit/src/views/Overlay/RootPortal';

import Box from '../../Box';
import Icon from '../../Icon';
import Pressable from '../../Pressable';

import type { ICON_NAMES } from '../../Icon/Icons';
import type { DeviceState } from '../../Provider/device';
import type { BottomTabBarProps } from '../BottomTabs/types';
import type { EdgeInsets } from 'react-native-safe-area-context';

const DEFAULT_TABBAR_HEIGHT = 49;

type Options = {
  deviceSize: DeviceState['size'];
};

const shouldUseHorizontalLabels = ({ deviceSize }: Options) =>
  !!['NORMAL'].includes(deviceSize);

const getPaddingBottom = (insets: EdgeInsets) =>
  Math.max(insets.bottom - Platform.select({ ios: 4, default: 0 }), 0);

export const getTabBarHeight = ({ insets }: { insets: EdgeInsets }) => {
  const paddingBottom = getPaddingBottom(insets);

  return DEFAULT_TABBAR_HEIGHT + paddingBottom;
};

export default function BottomTabBar({
  navigation,
  state,
  descriptors,
}: BottomTabBarProps) {
  const { size } = useUserDevice();
  const insets = useSafeAreaInsets();
  const { routes } = state;

  const paddingBottom = getPaddingBottom(insets);
  const tabBarHeight = getTabBarHeight({
    insets,
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
          <Box flex={1} p={1} key={route.name}>
            <Pressable
              alignItems="center"
              px={0.5}
              py={1.5}
              onPress={onPress}
              _hover={{ bg: 'surface-hovered' }}
              rounded="xl"
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
                color={isActive ? 'icon-default' : 'icon-subdued'}
                size={28}
              />
            </Pressable>
          </Box>
        );
      }),
    [descriptors, horizontal, navigation, routes, state.index, state.key],
  );

  return (
    <Box
      borderTopWidth={StyleSheet.hairlineWidth}
      left="0"
      right="0"
      bottom="0"
      bg="background-default"
      zIndex={99999}
      borderTopColor="divider"
      paddingBottom={`${paddingBottom}px`}
      height={tabBarHeight}
      py={Math.max(insets.left ?? 0, insets.right ?? 0)}
    >
      <Box accessibilityRole="tablist" flex="1" flexDirection="row">
        {tabs}
      </Box>
      <PortalExit name="BottomTab-Overlay" />
    </Box>
  );
}
