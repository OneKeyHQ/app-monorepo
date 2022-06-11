import React, { useLayoutEffect, useState } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { useWindowDimensions } from 'react-native';

import {
  Box,
  HStack,
  Icon,
  Input,
  Pressable,
  ScrollView,
  Typography,
  VStack,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import { getClipboard } from '@onekeyhq/components/src/utils/ClipboardUtils';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useAppSelector } from '@onekeyhq/kit/src/hooks/redux';
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

import { SendRoutes } from '../../routes';
import { dappClearSiteConnection } from '../../store/reducers/dapp';
import { refreshWebviewGlobalKey } from '../../store/reducers/status';

import type { CompositeNavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = CompositeNavigationProp<
  NativeStackNavigationProp<HomeRoutesParams, HomeRoutes.Dev>,
  NativeStackNavigationProp<StackBasicRoutesParams, StackRoutes.Developer>
>;

export const Debug = () => {
  const intl = useIntl();
  const inset = useSafeAreaInsets();
  const [uri, setUri] = useState('');
  const navigation = useNavigation<NavigationProps>();
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

  useLayoutEffect(() => {
    navigation.setOptions({
      title: intl.formatMessage({
        id: 'title__settings',
      }),
    });
  }, [navigation, intl]);

  return (
    <ScrollView px={4} py={{ base: 6, md: 8 }} bg="background-default">
      <Box w="full" maxW={768} mx="auto" pb={inset.bottom}>
        <Box borderRadius="12" bg="surface-default">
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
              <Typography.Body1>Components</Typography.Body1>
            </HStack>
            <Icon name="ChevronRightSolid" size={20} />
          </Pressable>
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
                if (platformEnv.isRuntimeBrowser) {
                  console.log({
                    innerWidth: window.innerWidth,
                    innerHeight: window.innerHeight,
                    outerWidth: window.outerWidth,
                    outerHeight: window.outerHeight,
                    clientWidth: window.document.documentElement.clientWidth,
                    clientHeight: window.document.documentElement.clientHeight,
                  });
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
                let uriText = uri;
                try {
                  const connectUri = (await getClipboard()) || '';
                  setUri(connectUri);
                  uriText = connectUri;
                } catch (err) {
                  console.error(err);
                }
                await backgroundApiProxy.walletConnect.connect({
                  uri: uriText,
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
            <Pressable
              {...pressableProps}
              onPress={() => {
                // @ts-ignore
                navigation.navigate(RootRoutes.Modal, {
                  screen: ModalRoutes.Send,
                  params: {
                    screen: SendRoutes.SendConfirmFromDapp,
                    params: {
                      query: `{
  "sourceInfo": {
    "id": 0,
    "origin": "https://swap.onekey.so",
    "scope": "ethereum",
    "data": {
      "method": "eth_sendTransaction",
      "params": [
        {
          "gas": "0xbf01",
          "from": "0x76f3f64cb3cd19debee51436df630a342b736c24",
          "to": "0xc748673057861a797275cd8a068abb95a902e8de",
          "data": "0x",
          "value": "0"
        }
      ],
      "jsonrpc": "2.0"
    }
  },
  "encodedTx": {
    "gas": "0xbf01",
    "from": "0x76f3f64cb3cd19debee51436df630a342b736c24",
    "to": "0xc748673057861a797275cd8a068abb95a902e8de",
    "data": "0x",
    "value": "0"
  }
}`,
                    },
                  },
                });
              }}
            >
              <Typography.Body1>NativeTransfer</Typography.Body1>
            </Pressable>
          </VStack>
        </Box>
      </Box>
    </ScrollView>
  );
};

export const DebugSection = () => {
  const navigation = useNavigation<NavigationProps>();

  if (!platformEnv.isDev) {
    return null;
  }
  return (
    <Box
      w="full"
      mb="6"
      borderRadius="12"
      bg="surface-default"
      shadow="depth.2"
    >
      <Pressable
        display="flex"
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
        py={4}
        px={{ base: 4, md: 6 }}
        onPress={() => {
          navigation.navigate(HomeRoutes.DebugScreen);
        }}
      >
        <Typography.Body1Strong>Developer</Typography.Body1Strong>
        <Box>
          <Icon name="ChevronRightSolid" size={20} />
        </Box>
      </Pressable>
    </Box>
  );
};
export default Debug;
