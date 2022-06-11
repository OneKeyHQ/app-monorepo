import React, { FC } from 'react';

import { CommonActions } from '@react-navigation/native';

import AccountSelector from '@onekeyhq/kit/src/components/Header/AccountSelector';
import ChainSelector from '@onekeyhq/kit/src/components/Header/ChainSelector';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import Box from '../../Box';
import DesktopDragZoneBox from '../../DesktopDragZoneBox';
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

  return (
    <Box
      position="relative"
      w={{ base: 56, lg: 64 }}
      h="full"
      bg="surface-subdued"
      px={4}
      pt={3}
      pb={5}
    >
      {!!platformEnv.isDesktopMac && <DesktopDragZoneBox w="100%" height={7} />}
      {/* Scrollable area */}
      <Box zIndex={1}>
        <AccountSelector />
      </Box>
      <VStack flex={1} mt={4} mb={2}>
        <ScrollView
          _contentContainerStyle={{
            flex: 1,
          }}
        >
          <VStack space={1} flex={1}>
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
                  mt={index === routes.length - 1 ? 'auto' : undefined}
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
      <ChainSelector />
    </Box>
  );
};
export default Sidebar;
