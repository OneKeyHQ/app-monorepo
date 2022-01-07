import React from 'react';

import { CommonActions } from '@react-navigation/native';
import { useIntl } from 'react-intl';
import { Platform, StyleSheet } from 'react-native';
import { EdgeInsets } from 'react-native-safe-area-context';

import Box from '../../Box';
import Icon from '../../Icon';
import Pressable from '../../Pressable';
import { DeviceState } from '../../Provider/device';
import {
  useSafeAreaInsets,
  useThemeValue,
  useUserDevice,
} from '../../Provider/hooks';
import Typography from '../../Typography';

import type { ChildProps } from '..';

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
  tabs,
  navigation,
  activeRouteName,
}: ChildProps) {
  const { size } = useUserDevice();
  const insets = useSafeAreaInsets();
  const intl = useIntl();

  const paddingBottom = getPaddingBottom(insets);
  const tabBarHeight = getTabBarHeight({
    insets,
  });

  const horizontal = shouldUseHorizontalLabels({
    deviceSize: size,
  });

  const [activeFontColor, inactiveFontColor] = useThemeValue([
    'text-default',
    'text-subdued',
  ]);

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
        {tabs.map((route) => {
          const isActive = activeRouteName === route.name;
          const onPress = () => {
            if (isActive) return;
            navigation.dispatch({
              ...CommonActions.navigate({ name: route.name, merge: true }),
            });
          };

          return (
            <Box flex={1} p={1} key={route.name}>
              <Pressable
                alignItems="center"
                p={0.5}
                bg="surface-subdued"
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
                  name={route.icon}
                  color={isActive ? 'icon-pressed' : 'icon-subdued'}
                  size={24}
                />
                <Typography.Caption
                  numberOfLines={1}
                  mt={0.5}
                  textAlign="center"
                  color={isActive ? activeFontColor : inactiveFontColor}
                  style={[
                    horizontal
                      ? {
                          fontSize: 13,
                          marginLeft: 20,
                          marginTop: 3,
                        }
                      : {
                          fontSize: 10,
                        },
                  ]}
                >
                  {intl.formatMessage({ id: route.translationId })}
                </Typography.Caption>
              </Pressable>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
