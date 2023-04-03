/* eslint-disable @typescript-eslint/no-unsafe-return */
import type { FC } from 'react';
import { useContext, useMemo } from 'react';

import { CommonActions } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { AnimatePresence, MotiView } from 'moti';

import { Center, Tooltip, useThemeValue } from '@onekeyhq/components';
import WalletSelectorTrigger from '@onekeyhq/kit/src/components/WalletSelector/WalletSelectorTrigger/WalletSelectorTrigger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import Box from '../../Box';
import { DesktopDragZoneAbsoluteBar } from '../../DesktopDragZoneBox';
import Icon from '../../Icon';
import Pressable from '../../Pressable';
import { Context } from '../../Provider/hooks/useProviderValue';
import useSafeAreaInsets from '../../Provider/hooks/useSafeAreaInsets';
import ScrollView from '../../ScrollView';
import Typography from '../../Typography';
import VStack from '../../VStack';

import type { ICON_NAMES } from '../../Icon';
import type { BottomTabBarProps } from '../BottomTabs';

const Sidebar: FC<BottomTabBarProps> = ({ navigation, state, descriptors }) => {
  const { routes } = state;
  const {
    leftSidebarCollapsed: isCollpase,
    setLeftSidebarCollapsed: setIsCollapse,
  } = useContext(Context);
  const { top } = useSafeAreaInsets(); // used for ipad
  const dragZoneAbsoluteBarHeight = platformEnv.isDesktopMac ? 20 : 0; // used for desktop
  const paddingTopValue = 12 + top + dragZoneAbsoluteBarHeight;

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
          <Tooltip
            key={route.key}
            label={options.tabBarLabel as string}
            isDisabled={!isCollpase}
            placement="right"
          >
            <Pressable
              key={route.name}
              onPress={onPress}
              flexDirection="row"
              alignItems="center"
              mt={index === routes.length - 1 ? 'auto' : undefined}
              p="8px"
              borderRadius="xl"
              bg={isActive ? 'surface-selected' : undefined}
              _hover={!isActive ? { bg: 'surface-hovered' } : undefined}
              aria-current={isActive ? 'page' : undefined}
            >
              <Box>
                <Icon
                  // @ts-expect-error
                  name={options?.tabBarIcon?.() as ICON_NAMES}
                  color={isActive ? 'icon-default' : 'icon-subdued'}
                  size={24}
                />
              </Box>

              <AnimatePresence initial={false}>
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
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                    }}
                  >
                    <Typography.Body2Strong
                      flex={1}
                      ml="3"
                      color={isActive ? activeFontColor : inactiveFontColor}
                      isTruncated
                    >
                      {options.tabBarLabel ?? route.name}
                    </Typography.Body2Strong>
                  </MotiView>
                )}
              </AnimatePresence>
            </Pressable>
          </Tooltip>
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
      testID="Desktop-AppSideBar-Container"
    >
      <DesktopDragZoneAbsoluteBar
        testID="Desktop-AppSideBar-DragZone"
        h={dragZoneAbsoluteBarHeight}
      />
      {/* Scrollable area */}
      <Box zIndex={1} testID="Desktop-AppSideBar-WalletSelector-Container">
        {/* <AccountSelector /> */}
        <WalletSelectorTrigger showWalletName={!isCollpase} />
      </Box>
      <VStack
        testID="Desktop-AppSideBar-Content-Container"
        flex={1}
        mt={4}
        mb={2}
      >
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
      <Box testID="Legacy-Desktop-AppSideBar-NetworkAccountSelector-Container">
        {/* <ChainSelector /> */}
        {/* <NetworkAccountSelectorTrigger /> */}
      </Box>
      <Pressable
        onPress={() => {
          setIsCollapse?.(!isCollpase);
        }}
        position="absolute"
        top="0"
        bottom="0"
        right="-10px"
        w="20px"
        testID="Desktop-AppSideBar-Collapse-Bar"
      >
        {({ isHovered, isPressed }) => (
          <MotiView
            animate={{ opacity: isHovered || isPressed ? 1 : 0 }}
            transition={{ type: 'timing', duration: 150 }}
            style={{ height: '100%', flexDirection: 'row' }}
          >
            <LinearGradient
              colors={['transparent', shadowColor]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                flex: 1,
                height: '100%',
                opacity: 0.1,
              }}
            />
            <Box
              h="full"
              w="1px"
              bgColor="interactive-default"
              alignItems="center"
            >
              <Center mt={`${paddingTopValue}px`} size="40px">
                <Box
                  p="4px"
                  rounded="full"
                  bgColor="background-default"
                  borderWidth="1px"
                  borderColor="border-subdued"
                  shadow="depth.1"
                >
                  <MotiView
                    animate={{ rotate: isCollpase ? '180deg' : '0deg' }}
                    transition={{ type: 'timing' }}
                  >
                    <Icon name="ChevronLeftMini" size={16} />
                  </MotiView>
                </Box>
              </Center>
            </Box>
            <Box flex={1} />
          </MotiView>
        )}
      </Pressable>
    </MotiView>
  );
};
export default Sidebar;
