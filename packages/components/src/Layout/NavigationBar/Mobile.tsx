import React from 'react';

import { CommonActions } from '@react-navigation/native';
import { Platform, StyleSheet } from 'react-native';
import { EdgeInsets } from 'react-native-safe-area-context';

import { setHaptics } from '../../../../kit/src/hooks/setHaptics';
import Box from '../../Box';
import Icon from '../../Icon';
import Pressable from '../../Pressable';
import { DeviceState } from '../../Provider/device';
import { useSafeAreaInsets, useUserDevice } from '../../Provider/hooks';

import type { ICON_NAMES } from '../../Icon/Icons';
import type { BottomTabBarProps } from '../BottomTabs/types';

const DEFAULT_TABBAR_HEIGHT = 55;

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

  return (
    <Box
      borderTopWidth={StyleSheet.hairlineWidth}
      left="0"
      right="0"
      bottom="0"
      bg="surface-subdued"
      borderTopColor="border-subdued"
      paddingBottom={`${paddingBottom}px`}
      height={tabBarHeight}
      py={Math.max(insets.left ?? 0, insets.right ?? 0)}
    >
      <Box accessibilityRole="tablist" flex="1" flexDirection="row">
        {routes.map((route, index) => {
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
            <Box flex={1} px={1} py={2} key={route.name}>
              <Pressable
                alignItems="center"
                p={0.5}
                bg="surface-subdued"
                onPress={() => {
                  setHaptics();
                  onPress();
                }}
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
                  name={options?.tabBarIcon?.() as ICON_NAMES}
                  color={isActive ? 'icon-pressed' : 'icon-subdued'}
                  size={24}
                />
              </Pressable>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
