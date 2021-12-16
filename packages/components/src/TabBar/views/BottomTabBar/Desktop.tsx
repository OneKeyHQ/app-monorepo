/* eslint-disable no-nested-ternary */
import React, { FC, useState } from 'react';

import { CommonActions } from '@react-navigation/native';
import { Box, Pressable, Text } from 'native-base';

import Icon from '../../../Icon';
import { useThemeValue } from '../../../Provider/hooks';

import type { BottomTabBarProps } from '../../types';

const Sidebar: FC<BottomTabBarProps> = ({ state, navigation, descriptors }) => {
  const { routes } = state;
  const [isCollapsed] = useState(false);
  const activeColor = useThemeValue('text-default');
  const inactiveColor = useThemeValue('text-subdued');

  return (
    <Box position="relative" width="260px" height="100%">
      <Box
        bg="background-default"
        width="100%"
        display="flex"
        flexDirection="column"
        height="100%"
        py="24px"
      >
        <Box
          pl="22px"
          flexShrink="0"
          display="flex"
          flexDirection="row"
          alignItems="center"
        >
          <Icon
            name="BrandLogoIllus"
            size={28}
            aria-label="The Brand Logo – OneKey"
          />
        </Box>
        <Box px="16px" flex="1" display="flex" flexDirection="column">
          <Box mt="6">
            <Box>
              <Box>
                <Text color="text-subdued">Trade</Text>
              </Box>
              <Box>
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
                        ...CommonActions.navigate({
                          name: route.name,
                          merge: true,
                        }),
                        target: state.key,
                      });
                    }
                  };

                  const onLongPress = () => {
                    navigation.emit({
                      type: 'tabLongPress',
                      target: route.key,
                    });
                  };

                  const label =
                    options.tabBarLabel !== undefined
                      ? options.tabBarLabel
                      : options.title !== undefined
                      ? options.title
                      : route.name;
                  return (
                    <Pressable
                      key={route.name}
                      onPress={onPress}
                      onLongPress={onLongPress}
                    >
                      <Box
                        bg={isActive ? 'background-selected' : undefined}
                        p="3"
                        mt="1"
                        aria-current={isActive ? 'page' : undefined}
                        display="flex"
                        flexDirection="column"
                        borderRadius="12px"
                      >
                        <Box
                          display="flex"
                          flexDirection="row"
                          alignItems="center"
                        >
                          {options.tabBarIcon
                            ? options.tabBarIcon({
                                focused: isActive,
                                color: isActive ? activeColor : inactiveColor,
                                size: 12,
                              })
                            : null}
                          {!isCollapsed && (
                            <Text
                              ml="3"
                              bold
                              lineHeight="24"
                              color={isActive ? activeColor : inactiveColor}
                            >
                              {label}
                            </Text>
                          )}
                        </Box>
                      </Box>
                    </Pressable>
                  );
                })}
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default Sidebar;
