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
import {
  StackBasicRoutesParams,
  StackRoutes,
} from '@onekeyhq/kit/src/routes/Dev';
import { HomeRoutes, HomeRoutesParams } from '@onekeyhq/kit/src/routes/types';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useAppSelector } from '../../hooks/redux';
import { dappClearSiteConnection } from '../../store/reducers/dapp';
import HelpSelector from '../Help/HelpSelector';

import type { CompositeNavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = CompositeNavigationProp<
  NativeStackNavigationProp<HomeRoutesParams, HomeRoutes.Dev>,
  NativeStackNavigationProp<StackBasicRoutesParams, StackRoutes.Developer>
>;

const Me = () => {
  const navigation = useNavigation<NavigationProps>();
  const intl = useIntl();
  const connections = useAppSelector((s) => s.dapp.connections);

  const pressableProps = {
    p: '4',
    bg: 'surface-default',
    borderRadius: '12px',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadow: 'depth.2',
  } as any;

  return (
    <Box bg="background-default" flex="1">
      <Box
        flex="1"
        p="4"
        maxW={MAX_PAGE_CONTAINER_WIDTH}
        w="100%"
        marginX="auto"
      >
        <VStack justifyContent="space-between" flex={1}>
          <VStack space="3">
            {/* <Pressable
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
          </Pressable> */}
            <Pressable
              p="4"
              bg="surface-default"
              borderRadius="12px"
              flexDirection="row"
              alignItems="center"
              justifyContent="space-between"
              shadow="depth.2"
              onPress={() =>
                navigation.navigate(HomeRoutes.ScreenOnekeyLiteDetail)
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
              onPress={() => navigation.navigate(HomeRoutes.SettingsScreen)}
              shadow="depth.2"
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
            {platformEnv.isDev && (
              <VStack space="3">
                <Pressable
                  {...pressableProps}
                  onPress={() => {
                    backgroundApiProxy.dispatch(dappClearSiteConnection());
                    backgroundApiProxy.serviceAccount.notifyAccountsChanged();
                  }}
                >
                  <Typography.Body1>
                    断开 Dapp 连接 ({connections.length})
                  </Typography.Body1>
                </Pressable>
                <Pressable
                  {...pressableProps}
                  onPress={() => {
                    navigation.push(HomeRoutes.Dev, {
                      screen: StackRoutes.ComponentLogger,
                    });
                  }}
                >
                  <Typography.Body1>Logger 设置</Typography.Body1>
                </Pressable>
              </VStack>
            )}
            {platformEnv.isDev && (
              <Pressable
                p="4"
                bg="surface-default"
                borderRadius="12px"
                flexDirection="row"
                alignItems="center"
                justifyContent="space-between"
                onPress={() => {
                  navigation.navigate(HomeRoutes.Dev, {
                    screen: StackRoutes.Developer,
                    params: {
                      ts: new Date().getTime(),
                    },
                  });
                }}
              >
                <HStack space="4">
                  <Icon name="DesktopComputerSolid" />
                  <Typography.Body1>Developer</Typography.Body1>
                </HStack>
                <Icon name="ChevronRightOutline" size={12} />
              </Pressable>
            )}
          </VStack>
          <HStack justifyContent="flex-end">
            <HelpSelector />
          </HStack>
        </VStack>
      </Box>
    </Box>
  );
};

export default Me;
