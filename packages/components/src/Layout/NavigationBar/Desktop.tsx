import React, { FC } from 'react';

import { CommonActions } from '@react-navigation/native';

import Box from '../../Box';
import Icon from '../../Icon';
import Pressable from '../../Pressable';
import { useThemeValue } from '../../Provider/hooks';
import ScrollView from '../../ScrollView';
import Typography from '../../Typography';
import VStack from '../../VStack';

import type { ICON_NAMES } from '../../Icon/Icons';
import type { BottomTabBarProps } from '../BottomTabs/types';

const Sidebar: FC<BottomTabBarProps> = ({ navigation, state, descriptors }) => {
  const { routes } = state;
  const [activeFontColor, inactiveFontColor] = useThemeValue([
    'text-default',
    'text-subdued',
  ]);

  const firstOptions = descriptors[routes[0].key].options;

  return (
    <Box
      position="relative"
      w={64}
      h="full"
      bg="surface-subdued"
      borderRightWidth={1}
      borderRightColor="border-subdued"
    >
      <VStack flex={1}>
        {/* AccountSelector */}
        <Box py={1} px={4} w="full">
          {firstOptions?.tabBarBackground?.()}
        </Box>
        {/* Scrollable area */}
        <ScrollView
          _contentContainerStyle={{
            flex: 1,
            py: 5,
            px: 4,
          }}
        >
          <VStack space={1}>
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
              return (
                <Pressable
                  key={route.name}
                  onPress={onPress}
                  _hover={!isActive ? { bg: 'surface-hovered' } : undefined}
                  bg={isActive ? 'surface-selected' : undefined}
                  borderRadius="xl"
                  p="2"
                >
                  <Box
                    aria-current={isActive ? 'page' : undefined}
                    display="flex"
                    flexDirection="column"
                  >
                    <Box display="flex" flexDirection="row" alignItems="center">
                      <Icon
                        // @ts-expect-error
                        name={options?.tabBarIcon?.() as ICON_NAMES}
                        color={isActive ? 'icon-pressed' : 'icon-default'}
                        size={24}
                      />

                      <Typography.Body2Strong
                        ml="3"
                        color={isActive ? activeFontColor : inactiveFontColor}
                      >
                        {options.tabBarLabel ?? route.name}
                      </Typography.Body2Strong>
                    </Box>
                  </Box>
                  {/* In the future, perhaps a 'Badge' will be placed here. */}
                </Pressable>
              );
            })}
          </VStack>
          {/* <VStack space={1} pt={1} mt="auto">
            <Typography.Body2Strong>
              Address book and settings here.
            </Typography.Body2Strong>
          </VStack> */}
        </ScrollView>
      </VStack>
    </Box>
  );
};
export default Sidebar;
