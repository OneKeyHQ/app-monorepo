/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useState } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { Platform, useWindowDimensions } from 'react-native';

import {
  Box,
  HStack,
  Icon,
  Input,
  Pressable,
  Typography,
  VStack,
} from '@onekeyhq/components';
import { getClipboard } from '@onekeyhq/components/src/utils/ClipboardUtils';
import { MAX_PAGE_CONTAINER_WIDTH } from '@onekeyhq/kit/src/config';
import {
  StackBasicRoutesParams,
  StackRoutes,
} from '@onekeyhq/kit/src/routes/Dev';
import {
  HomeRoutes,
  HomeRoutesParams,
  ModalRoutes,
  RootRoutes,
} from '@onekeyhq/kit/src/routes/types';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useAppSelector } from '../../hooks/redux';
import { SendRoutes } from '../../routes';
import { dappClearSiteConnection } from '../../store/reducers/dapp';
import { refreshWebviewGlobalKey } from '../../store/reducers/status';
import HelpSelector from '../Help/HelpSelector';

import type { CompositeNavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = CompositeNavigationProp<
  NativeStackNavigationProp<HomeRoutesParams, HomeRoutes.Dev>,
  NativeStackNavigationProp<StackBasicRoutesParams, StackRoutes.Developer>
>;

const Me = () => {
  const [uri, setUri] = useState('');
  const navigation = useNavigation<NavigationProps>();
  const intl = useIntl();
  const connections = useAppSelector((s) => s.dapp.connections);
  const webviewKey = useAppSelector((s) => s.status.webviewGlobalKey);
  const { width, height } = useWindowDimensions();

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
        px={{ base: 4, md: 0 }}
        py={{ base: 6, md: 8 }}
        maxW={MAX_PAGE_CONTAINER_WIDTH}
        w="100%"
        marginX="auto"
      >
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
          {platformEnv.isNative ? (
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
                <Typography.Body1>
                  {intl.formatMessage({ id: 'app__hardware_name_onekey_lite' })}
                </Typography.Body1>
              </HStack>
              <Icon name="ChevronRightSolid" size={20} />
            </Pressable>
          ) : null}
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
            <Icon name="ChevronRightSolid" size={20} />
          </Pressable>
          {platformEnv.isDev && (
            <VStack space="3">
              <Pressable
                {...pressableProps}
                onPress={async () => {
                  // TODO define service method
                  await backgroundApiProxy.walletConnect.disconnect();
                  backgroundApiProxy.dispatch(dappClearSiteConnection());
                  backgroundApiProxy.dispatch(refreshWebviewGlobalKey());
                  backgroundApiProxy.serviceAccount.notifyAccountsChanged();
                }}
              >
                <Typography.Body1>
                  断开 Dapp 连接 ({connections.length}) {webviewKey}
                </Typography.Body1>
              </Pressable>
              <Pressable
                {...pressableProps}
                onPress={() => {
                  navigation.navigate(HomeRoutes.Dev, {
                    screen: StackRoutes.ComponentLogger,
                  });
                }}
              >
                <Typography.Body1>Logger 设置</Typography.Body1>
              </Pressable>
              <Pressable
                {...pressableProps}
                onPress={() => {
                  if (platformEnv.isBrowser) {
                    console.log({
                      innerWidth: window.innerWidth,
                      innerHeight: window.innerHeight,
                      outerWidth: window.outerWidth,
                      outerHeight: window.outerHeight,
                      clientWidth: window.document.documentElement.clientWidth,
                      clientHeight:
                        window.document.documentElement.clientHeight,
                    });
                    // console.log(document.documentElement.outerHTML);
                  }
                }}
              >
                <Typography.Body1>
                  useWindowDimensions {width}x{height}
                </Typography.Body1>
              </Pressable>
              <HStack>
                <Input
                  value={uri}
                  onChangeText={(t) => setUri(t)}
                  placeholder="WalletConnect QrCode scan uri"
                  clearButtonMode="always"
                  clearTextOnFocus
                />
              </HStack>
              <Pressable
                {...pressableProps}
                onPress={async () => {
                  const connectUri = (await getClipboard()) || '';
                  setUri(connectUri);
                  await backgroundApiProxy.walletConnect.connect({
                    uri: connectUri,
                  });
                }}
              >
                <Typography.Body1>连接 WalletConnect</Typography.Body1>
              </Pressable>
              <Pressable
                {...pressableProps}
                onPress={async () => {
                  await backgroundApiProxy.walletConnect.disconnect();
                }}
              >
                <Typography.Body1>断开 WalletConnect</Typography.Body1>
              </Pressable>
              <Pressable
                {...pressableProps}
                onPress={() => {
                  // @ts-ignore
                  navigation.navigate(RootRoutes.Modal, {
                    screen: ModalRoutes.Send,
                    params: {
                      screen: SendRoutes.SendConfirmFromDapp,
                      params: {
                        query: `{"sourceInfo":{"id":0,"origin":"https://swap.onekey.so","scope":"ethereum","data":{"method":"eth_sendTransaction","params":[{"gas":"0xbf01","from":"0x76f3f64cb3cd19debee51436df630a342b736c24","to":"0xc748673057861a797275cd8a068abb95a902e8de","data":"0x095ea7b3000000000000000000000000def1c0ded9bec7f1a1670819833240f027b25effffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"}],"jsonrpc":"2.0"}},"encodedTx":{"gas":"0xbf01","from":"0x76f3f64cb3cd19debee51436df630a342b736c24","to":"0xc748673057861a797275cd8a068abb95a902e8de","data":"0x095ea7b3000000000000000000000000def1c0ded9bec7f1a1670819833240f027b25effffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"}}`,
                      },
                    },
                  });
                }}
              >
                <Typography.Body1>Dapp Token Approve</Typography.Body1>
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
              <Icon name="ChevronRightSolid" size={20} />
            </Pressable>
          )}
        </VStack>
      </Box>
      <Box
        position="absolute"
        bottom={{ base: 4, md: 8 }}
        right={{ base: 4, md: 8 }}
      >
        <HelpSelector />
      </Box>
    </Box>
  );
};

export default Me;
