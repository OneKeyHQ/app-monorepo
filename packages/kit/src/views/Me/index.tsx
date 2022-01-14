import React from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  HStack,
  Icon,
  Pressable,
  Typography,
  VStack,
} from '@onekeyhq/components';
import { MAX_PAGE_CONTAINER_WIDTH } from '@onekeyhq/kit/src/config';
import { StackBasicRoutes, StackRoutesParams } from '@onekeyhq/kit/src/routes';

import { ModalRoutes } from '../../routes/Modal/index';
import {
  HardwareConnectModalRoutes,
  HardwareConnectStackNavigationProp,
} from '../Hardware/Connect/types';
import { HardwarePinCodeStackNavigationProp } from '../Hardware/OnekeyLite/PinCode/types';
import HelpSelector from '../Help/HelpSelector';
import { TokenDetailNavigation } from '../TokenDetail/routes';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  StackRoutesParams,
  StackBasicRoutes.Developer
> &
  TokenDetailNavigation &
  HardwareConnectStackNavigationProp &
  HardwarePinCodeStackNavigationProp;

const Me = () => {
  const navigation = useNavigation<NavigationProps>();
  const intl = useIntl();

  return (
    <Box flex="1" p="4" maxW={MAX_PAGE_CONTAINER_WIDTH} w="100%" marginX="auto">
      <VStack justifyContent="space-between" flex={1}>
        <VStack space="3">
          <Pressable
            p="4"
            bg="surface-default"
            borderRadius="12px"
            flexDirection="row"
            alignItems="center"
            justifyContent="space-between"
          >
            <HStack space="4">
              <Icon name="BookOpenOutline" />
              <Typography.Body1>
                {intl.formatMessage({
                  id: 'title__address_book',
                  defaultMessage: 'Address Book',
                })}
              </Typography.Body1>
            </HStack>
            <Icon name="ChevronRightOutline" size={12} />
          </Pressable>
          <Pressable
            p="4"
            bg="surface-default"
            borderRadius="12px"
            flexDirection="row"
            alignItems="center"
            justifyContent="space-between"
            onPress={() =>
              navigation.navigate(StackBasicRoutes.ScreenOnekeyLiteDetail)
            }
          >
            <HStack space="4">
              <Icon name="CreditCardOutline" />
              <Typography.Body1>OneKey Lite</Typography.Body1>
            </HStack>
            <Icon name="ChevronRightOutline" size={12} />
          </Pressable>
          <Pressable
            p="4"
            bg="surface-default"
            borderRadius="12px"
            flexDirection="row"
            alignItems="center"
            justifyContent="space-between"
            onPress={() => navigation.navigate(StackBasicRoutes.SettingsScreen)}
          >
            <HStack space="4">
              <Icon name="CogOutline" />
              <Typography.Body1>
                {intl.formatMessage({
                  id: 'title__settings',
                  defaultMessage: 'Settings',
                })}
              </Typography.Body1>
            </HStack>
            <Icon name="ChevronRightOutline" size={12} />
          </Pressable>
          <Pressable
            p="4"
            bg="surface-default"
            borderRadius="12px"
            flexDirection="row"
            alignItems="center"
            justifyContent="space-between"
            onPress={() =>
              navigation.navigate(StackBasicRoutes.Developer, {
                ts: new Date().getTime(),
              })
            }
          >
            <HStack space="4">
              <Icon name="DesktopComputerSolid" />
              <Typography.Body1>Developer</Typography.Body1>
            </HStack>
            <Icon name="ChevronRightOutline" size={12} />
          </Pressable>
          <Pressable
            p="4"
            bg="surface-default"
            borderRadius="12px"
            flexDirection="row"
            alignItems="center"
            justifyContent="space-between"
            onPress={() =>
              navigation.navigate(
                HardwareConnectModalRoutes.HardwareConnectModal,
                {
                  defaultValues: {
                    title: 'sdf',
                    connectType: 'ble',
                  },
                },
              )
            }
          >
            <Typography.Body1>Onekey Lite Connect</Typography.Body1>
            <Icon name="ChevronRightOutline" size={12} />
          </Pressable>
          <Pressable
            p="4"
            bg="surface-default"
            borderRadius="12px"
            flexDirection="row"
            alignItems="center"
            justifyContent="space-between"
            onPress={() =>
              navigation.navigate(ModalRoutes.HardwarePinCodeModal, {
                defaultValues: {
                  title: 'Setup New PIN',
                  description: 'Set a PIN for OneKey Lite',
                },
              })
            }
          >
            <Typography.Body1>Onekey Lite PinCode</Typography.Body1>
            <Icon name="ChevronRightOutline" size={12} />
          </Pressable>
        </VStack>
        <HStack justifyContent="flex-end">
          <HelpSelector />
        </HStack>
      </VStack>
    </Box>
  );
};

export default Me;
