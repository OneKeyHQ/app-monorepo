/* eslint-disable @typescript-eslint/no-unsafe-return */
import type { FC } from 'react';
import { useMemo } from 'react';

import { CommonActions } from '@react-navigation/native';

import { useThemeValue } from '@onekeyhq/components';
import WalletSelectorTrigger from '@onekeyhq/kit/src/components/WalletSelector/WalletSelectorTrigger/WalletSelectorTrigger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import Box from '../../Box';
import { DesktopDragZoneAbsoluteBar } from '../../DesktopDragZoneBox';
import Icon from '../../Icon';
import Pressable from '../../Pressable';
import ScrollView from '../../ScrollView';
import Typography from '../../Typography';
import VStack from '../../VStack';

import type { ICON_NAMES } from '../../Icon';
import type { BottomTabBarProps } from '../BottomTabs';

const Sidebar: FC<BottomTabBarProps> = ({ navigation, state, descriptors }) => {
  const { routes } = state;

  const [activeFontColor, inactiveFontColor] = useThemeValue([
    'text-default',
    'text-subdued',
  ]);

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
                  color={isActive ? 'icon-default' : 'icon-subdued'}
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
      }),
    [
      activeFontColor,
      descriptors,
      inactiveFontColor,
      navigation,
      routes,
      state.index,
      state.key,
    ],
  );

  const paddingTopValue = 3 + (platformEnv.isDesktopMac ? 5 : 0);
  return (
    <Box
      position="relative"
      w="224px"
      h="full"
      bg="surface-subdued"
      px={4}
      pt={paddingTopValue}
      pb={5}
    >
      <DesktopDragZoneAbsoluteBar h={paddingTopValue} />
      {/* Scrollable area */}
      <Box zIndex={1} testID="Desktop-WalletSelector-Container">
        {/* <AccountSelector /> */}
        <WalletSelectorTrigger />
      </Box>
      <VStack flex={1} mt={4} mb={2}>
        <ScrollView
          _contentContainerStyle={{
            flex: 1,
          }}
        >
          <VStack space={1} flex={1}>
            {tabs}
          </VStack>
        </ScrollView>
      </VStack>
      <Box testID="Legacy-Desktop-NetworkAccountSelector-Container">
        {/* <ChainSelector /> */}
        {/* <NetworkAccountSelectorTrigger /> */}
      </Box>
    </Box>
  );
};
export default Sidebar;
