/* eslint-disable @typescript-eslint/no-unsafe-return */
import type { FC } from 'react';
import { useMemo, useState } from 'react';

import { CommonActions } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { AnimatePresence, MotiView } from 'moti';

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
  const [isCollpase, setIsCollapse] = useState(false);
  const paddingTopValue = 12 + (platformEnv.isDesktopMac ? 20 : 0);

  const [
    sidebarBackgroundColor,
    activeFontColor,
    inactiveFontColor,
    shadowColor,
  ] = useThemeValue([
    'surface-subdued',
    'text-default',
    'text-subdued',
    'interactive-default',
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
            p="8px"
          >
            <Box
              aria-current={isActive ? 'page' : undefined}
              display="flex"
              flexDirection="column"
            >
              <Box display="flex" flexDirection="row" alignItems="center">
                <Box>
                  <Icon
                    // @ts-expect-error
                    name={options?.tabBarIcon?.() as ICON_NAMES}
                    color={isActive ? 'icon-default' : 'icon-subdued'}
                    size={24}
                  />
                </Box>

                <AnimatePresence>
                  {/* hide label while collapse sidebar */}
                  {!isCollpase && (
                    <MotiView
                      from={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{
                        opacity: 0,
                      }}
                      transition={{
                        type: 'timing',
                        duration: 150,
                      }}
                    >
                      <Typography.Body2Strong
                        ml="3"
                        color={isActive ? activeFontColor : inactiveFontColor}
                      >
                        {options.tabBarLabel ?? route.name}
                      </Typography.Body2Strong>
                    </MotiView>
                  )}
                </AnimatePresence>
              </Box>
            </Box>
          </Pressable>
        );
      }),
    [
      activeFontColor,
      descriptors,
      inactiveFontColor,
      isCollpase,
      navigation,
      routes,
      state.index,
      state.key,
    ],
  );

  return (
    <MotiView
      animate={{ width: isCollpase ? 72 : 224 }}
      transition={{
        type: 'timing',
        duration: 150,
      }}
      style={{
        height: '100%',
        width: 224,
        backgroundColor: sidebarBackgroundColor,
        paddingHorizontal: 16,
        paddingTop: paddingTopValue,
        paddingBottom: 20,
      }}
    >
      <DesktopDragZoneAbsoluteBar h={paddingTopValue} />
      {/* Scrollable area */}
      <Box zIndex={1} testID="Desktop-WalletSelector-Container">
        {/* <AccountSelector /> */}
        <WalletSelectorTrigger showWalletName={!isCollpase} />
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
      <Pressable
        onPress={() => {
          setIsCollapse(!isCollpase);
        }}
        position="absolute"
        top="0"
        bottom="0"
        right="-8px"
        pr="8px"
      >
        {({ isHovered }) => (
          <MotiView
            animate={{ opacity: isHovered ? 1 : 0 }}
            transition={{ type: 'timing', duration: 150 }}
            style={{ height: '100%', flexDirection: 'row' }}
          >
            <LinearGradient
              colors={['transparent', shadowColor]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                height: 'full',
                width: '8px',
                opacity: 0.1,
              }}
            />
            <Box h="full" width="1px" bgColor="interactive-default" />
          </MotiView>
        )}
      </Pressable>
    </MotiView>
  );
};
export default Sidebar;
