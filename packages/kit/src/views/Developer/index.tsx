/* eslint-disable @typescript-eslint/no-unused-vars */
import { useCallback, useLayoutEffect, useState } from 'react';

import { useNavigation } from '@react-navigation/core';
import fetch from 'cross-fetch';
import { useIntl } from 'react-intl';
import { useWindowDimensions } from 'react-native';

import {
  Box,
  HStack,
  Icon,
  Input,
  Pressable,
  ScrollView,
  ToastManager,
  Typography,
  VStack,
} from '@onekeyhq/components';
import { getClipboard } from '@onekeyhq/components/src/utils/ClipboardUtils';
import type { OneKeyError } from '@onekeyhq/engine/src/errors';
import { batchTransferContractAddress } from '@onekeyhq/engine/src/presets/batchTransferContractAddress';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  getActiveWalletAccount,
  useActiveWalletAccount,
  useAppSelector,
} from '@onekeyhq/kit/src/hooks/redux';
import {
  HomeRoutes,
  ModalRoutes,
  RootRoutes,
} from '@onekeyhq/kit/src/routes/routesEnum';
import type {
  HomeRoutesParams,
  RootRoutesParams,
} from '@onekeyhq/kit/src/routes/types';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import walletConnectUtils from '../../components/WalletConnect/utils/walletConnectUtils';
import { WalletConnectDappSideTest } from '../../components/WalletConnect/WalletConnectDappSideTest';
import { useNavigationActions } from '../../hooks';
import useAppNavigation from '../../hooks/useAppNavigation';
import {
  GalleryRoutes,
  MainRoutes,
  SendModalRoutes,
} from '../../routes/routesEnum';
import { dappClearSiteConnection } from '../../store/reducers/dapp';
import { refreshWebviewGlobalKey } from '../../store/reducers/status';
import { openUrlByWebview } from '../../utils/openUrl';

import type { GalleryParams } from '../../routes/Root/Gallery';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = CompositeNavigationProp<
  NativeStackNavigationProp<RootRoutesParams, RootRoutes.Main>,
  NativeStackNavigationProp<GalleryParams, GalleryRoutes.Components>
>;

const DEFAULT_TEST_EVM_ADDRESS_1 = '0x76f3f64cb3cd19debee51436df630a342b736c24';
const DEFAULT_TEST_EVM_ADDRESS_2 = '0xA9b4d559A98ff47C83B74522b7986146538cD4dF';
export const Debug = () => {
  const intl = useIntl();
  const [uri, setUri] = useState('');
  const navigation = useNavigation<NavigationProps>();
  const navigationRoot = useAppNavigation();
  const connections = useAppSelector((s) => s.dapp.connections);
  const webviewKey = useAppSelector((s) => s.status.webviewGlobalKey);
  console.log('Developer Debug page render >>>>>>>');
  const { width, height } = useWindowDimensions();
  const { network, account, wallet } = useActiveWalletAccount();
  const { serviceAccount, engine } = backgroundApiProxy;
  const navigationActions = useNavigationActions();

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

  const handleApproveToken = useCallback(
    async ({
      networkId,
      accountId,
      token,
      spender,
      amount,
    }: {
      networkId: string;
      accountId: string;
      token: string;
      amount: string;
      spender: string;
    }) => {
      const encodedApproveTx =
        await backgroundApiProxy.engine.buildEncodedTxFromApprove({
          amount,
          networkId,
          spender,
          accountId,
          token,
        });

      return new Promise((resolve) => {
        // @ts-ignore
        navigation.navigate(RootRoutes.Modal, {
          screen: ModalRoutes.Send,
          params: {
            screen: SendModalRoutes.SendConfirm,
            params: {
              accountId,
              networkId,
              feeInfoEditable: true,
              feeInfoUseFeeInTx: false,
              encodedTx: encodedApproveTx,
              onSuccess: () => {
                resolve('');
              },
            },
          },
        });
      });
    },
    [navigation],
  );

  const handleBatchTransfer = useCallback(
    async (token?: string) => {
      const { networkId, accountId, accountAddress } = getActiveWalletAccount();
      let transferInfos;
      if (token) {
        transferInfos = [
          {
            from: accountAddress,
            to: DEFAULT_TEST_EVM_ADDRESS_1,
            token,
            amount: '1',
          },
          {
            from: accountAddress,
            to: DEFAULT_TEST_EVM_ADDRESS_2,
            token,
            amount: '1',
          },
        ];
      } else {
        transferInfos = [
          {
            from: accountAddress,
            to: DEFAULT_TEST_EVM_ADDRESS_1,
            amount: '0.001',
          },
          {
            from: accountAddress,
            to: DEFAULT_TEST_EVM_ADDRESS_2,
            amount: '0.001',
          },
        ];
      }

      if (token) {
        await handleApproveToken({
          networkId,
          accountId,
          spender: batchTransferContractAddress[networkId],
          token,
          amount: '2',
        });
      }

      const encodedTx = await engine.buildEncodedTxFromBatchTransfer({
        networkId,
        accountId,
        transferInfos,
      });

      // @ts-ignore
      navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.Send,
        params: {
          screen: SendModalRoutes.SendConfirm,
          params: {
            accountId,
            networkId,
            encodedTx,
            feeInfoUseFeeInTx: false,
            feeInfoEditable: true,
            backRouteName: SendModalRoutes.PreSendAddress,
          },
        },
      });
    },
    [engine, handleApproveToken, navigation],
  );

  return (
    <ScrollView px={4} py={{ base: 6, md: 8 }} bg="background-default">
      <Box w="full" maxW={768} mx="auto" pb={9}>
        <Box borderRadius="12" bg="surface-default">
          <Pressable
            p="4"
            bg="surface-default"
            borderRadius="12px"
            flexDirection="row"
            alignItems="center"
            justifyContent="space-between"
            onPress={() => {
              navigation.navigate(RootRoutes.Gallery, {
                screen: GalleryRoutes.Components,
                params: {
                  ts: new Date().getTime(),
                },
              });
            }}
          >
            <HStack space="4">
              <Icon name="DesktopComputerMini" />
              <Typography.Body1>Components</Typography.Body1>
            </HStack>
            <Icon name="ChevronRightMini" size={20} />
          </Pressable>
          <VStack space="3">
            <Pressable
              {...pressableProps}
              onPress={async () => {
                // TODO define service method
                await backgroundApiProxy.walletConnect.disconnect();
                // backgroundApiProxy.dispatch(dappClearSiteConnection());
                // backgroundApiProxy.dispatch(refreshWebviewGlobalKey());

                // dispatch batch actions
                backgroundApiProxy.dispatch(
                  dappClearSiteConnection(),
                  refreshWebviewGlobalKey(),
                );
                backgroundApiProxy.serviceAccount.notifyAccountsChanged();
              }}
            >
              <Typography.Body1>
                断开 Dapp 连接 ({connections.length}) {webviewKey}
              </Typography.Body1>
            </Pressable>
            <WalletConnectDappSideTest {...pressableProps} />
            <Pressable
              {...pressableProps}
              onPress={() => {
                navigation.navigate(RootRoutes.Gallery, {
                  screen: GalleryRoutes.ComponentLogger,
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
                if (uriText) {
                  walletConnectUtils.openConnectToDappModal({
                    uri: uriText,
                    isDeepLink: true,
                  });
                } else {
                  console.error('walletConnect connect ERROR:  uri is Empty');
                }
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
              onPress={async () => {
                try {
                  const address = (await getClipboard()) || '';
                  const acc = await serviceAccount.addTemporaryWatchAccount({
                    address,
                  });
                  console.log('Add Temp Watching Account', acc, address);
                  ToastManager.show({
                    title: `Added temp watching: ${address}`,
                  });
                } catch (err) {
                  console.error(err);
                }
              }}
            >
              <Typography.Body1>Add Temp Watching Account</Typography.Body1>
            </Pressable>
            <Pressable
              {...pressableProps}
              onPress={() => {
                console.log({
                  account,
                  wallet,
                  network,
                });
                const {
                  href,
                  protocol,
                  host,
                  hostname,
                  port,
                  pathname,
                  origin,
                  search,
                  searchParams,
                  hash,
                } = new URL(
                  'https://github.com:80/OneKeyHQ/app-monorepo/pulls?q=is%3Apr+is%3Aclosed#link',
                );
                console.log({
                  href,
                  protocol,
                  host,
                  hostname,
                  port,
                  pathname,
                  origin,
                  search,
                  searchParams,
                  hash,
                });
                // NativeModules.Minimizer.minimize();
                fetch('https://requestbin.io/1a7x2jt1', {
                  headers: {
                    'X-requested-byy': 'onekey',
                    // native support custom origin header
                    'Origin':
                      'chrome-extension://nkbihfbeogaeaoehlefnkodbefgpgknn',
                  },
                });
              }}
            >
              <Typography.Body1>Log current wallet</Typography.Body1>
            </Pressable>
            <Pressable
              {...pressableProps}
              onPress={() => {
                const { networkId, accountId } = getActiveWalletAccount();
                navigationRoot.navigate(RootRoutes.Modal, {
                  screen: ModalRoutes.Send,
                  params: {
                    screen: SendModalRoutes.SendFeedbackReceipt,
                    params: {
                      networkId,
                      accountId,
                      txid: 'test-txid',
                      type: 'Send',
                    },
                  },
                });
              }}
            >
              <Typography.Body1>Send Success Feedback</Typography.Body1>
            </Pressable>
            <Pressable
              {...pressableProps}
              onPress={() => {
                openUrlByWebview('https://dapp-example.test.onekey.so/');
              }}
            >
              <Typography.Body1>Dapp Test</Typography.Body1>
            </Pressable>
            <Pressable
              {...pressableProps}
              onPress={() => {
                /*
                // Approve Token
               var p = {"method":"eth_sendTransaction","params":[{"gas":"0xbf01","from":"0x76f3f64cb3cd19debee51436df630a342b736c24","to":"0xc748673057861a797275cd8a068abb95a902e8de","value": "0xa3b5840f4000","data":"0x095ea7b3000000000000000000000000def1c0ded9bec7f1a1670819833240f027b25effffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"}],"jsonrpc":"2.0"};
               await window.ethereum.request(p);
                 */
                const { networkId, accountId } = getActiveWalletAccount();
                navigationRoot.navigate(RootRoutes.Modal, {
                  screen: ModalRoutes.Send,
                  params: {
                    screen: SendModalRoutes.SendConfirmFromDapp,
                    params: {
                      // type: 'Send',
                      // networkId,
                      // accountId,
                      query: `{"sourceInfo":{"id":0,"origin":"https://swap.onekey.so","scope":"ethereum","data":{

                      "method":"eth_sendTransaction","params":[
                      {
                        "gas":"0xbf01",
                        "from":"0x76f3f64cb3cd19debee51436df630a342b736c24",
                        "to":"0xc748673057861a797275cd8a068abb95a902e8de",
                        "value": "0xa3b5840f4000",
                        "data":"0x095ea7b3000000000000000000000000def1c0ded9bec7f1a1670819833240f027b25effffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
                      }

                      ],"jsonrpc":"2.0"}},

                      "encodedTx":
                      {
                        "gas":"0xbf01",
                        "from":"0x76f3f64cb3cd19debee51436df630a342b736c24",
                        "to":"0xc748673057861a797275cd8a068abb95a902e8de",
                        "value": "0xa3b5840f4000",
                        "data":"0x095ea7b3000000000000000000000000def1c0ded9bec7f1a1670819833240f027b25effffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
                      }

                      }`,
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
                /*
                // Send Native Token
                var p = {
                    "method": "eth_sendTransaction",
                    "params": [
                      {
                        "from": "0x76f3f64cb3cd19debee51436df630a342b736c24",
                        "to": "0xa9b4d559a98ff47c83b74522b7986146538cd4df",
                        "data": "0x",
                        "value": "0xa3b5840f4000"
                      }
                    ],
                    "jsonrpc": "2.0"
                  };
                  await window.ethereum.request(p);
                 */
                const randomValue = `0x${Math.floor(
                  Math.random() * 10 ** 15,
                ).toString(16)}`;
                const { networkId, accountId } = getActiveWalletAccount();
                navigationRoot.navigate(RootRoutes.Modal, {
                  screen: ModalRoutes.Send,
                  params: {
                    screen: SendModalRoutes.SendConfirmFromDapp,
                    params: {
                      // type: 'Send',
                      // networkId,
                      // accountId,
                      query: `{
  "sourceInfo": {
    "id": 0,
    "origin": "https://swap.onekey.so",
    "scope": "ethereum",
    "data": {
      "method": "eth_sendTransaction",
      "params": [
        {
          "to": "0xa9b4d559a98ff47c83b74522b7986146538cd4dF",
          "data": "0x",
          "value": "${randomValue}"
        }
      ],
      "jsonrpc": "2.0"
    }
  },
  "encodedTx": {
    "to": "0xa9b4d559a98ff47c83b74522b7986146538cd4dF",
    "data": "0x",
    "value": "${randomValue}"
  }
}`,
                    },
                  },
                });
              }}
            >
              <Typography.Body1>NativeTransfer</Typography.Body1>
            </Pressable>
            <Pressable
              {...pressableProps}
              onPress={() => {
                /*
                // Approve Token
               var p = {"method":"eth_sendTransaction","params":[{"gas":"0xbf01","from":"0x76f3f64cb3cd19debee51436df630a342b736c24","to":"0xc748673057861a797275cd8a068abb95a902e8de","value": "0xa3b5840f4000","data":"0x095ea7b3000000000000000000000000def1c0ded9bec7f1a1670819833240f027b25effffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"}],"jsonrpc":"2.0"};
               await window.ethereum.request(p);
                 */
                const { networkId, accountId, accountAddress } =
                  getActiveWalletAccount();
                navigationRoot.navigate(RootRoutes.Modal, {
                  screen: ModalRoutes.Send,
                  params: {
                    screen: SendModalRoutes.SendConfirmFromDapp,
                    params: {
                      // type: 'Send',
                      // networkId,
                      // accountId,
                      query: `{

                      "sourceInfo":{"id":2,"origin":"https://dapp-example.onekeytest.com","scope":"ethereum","data":{

                      "method":"personal_sign","params":["0x4578616d706c652060706572736f6e616c5f7369676e60206d657373616765","${accountAddress}","Example password"],"jsonrpc":"2.0"}},

                      "unsignedMessage":{"type":1,"message":"0x4578616d706c652060706572736f6e616c5f7369676e60206d657373616765","payload":["0x4578616d706c652060706572736f6e616c5f7369676e60206d657373616765","${accountAddress}","Example password"]}

                      }`,
                    },
                  },
                });
              }}
            >
              <Typography.Body1>PersonalSign</Typography.Body1>
            </Pressable>
            <Pressable
              {...pressableProps}
              onPress={() => {
                // openUrlByWebview('https://www.bing.com');
                openUrlByWebview('http://192.168.31.204:3008/#/cardano');
              }}
            >
              <Typography.Body1>Open web-embed</Typography.Body1>
            </Pressable>
            <Pressable
              {...pressableProps}
              onPress={() => handleBatchTransfer()}
            >
              <Typography.Body1>Batch Transfer ETH 0</Typography.Body1>
            </Pressable>
            <Pressable
              {...pressableProps}
              onPress={() =>
                handleBatchTransfer(
                  '0xdc31ee1784292379fbb2964b3b9c4124d8f89c60',
                )
              }
            >
              <Typography.Body1>Batch Transfer DAI</Typography.Body1>
            </Pressable>
            <Pressable
              {...pressableProps}
              onPress={() => navigationActions.openDrawer()}
            >
              <Typography.Body1>Open Drawer</Typography.Body1>
            </Pressable>

            <Pressable
              {...pressableProps}
              onPress={async () => {
                try {
                  const password =
                    await backgroundApiProxy.servicePassword.getPassword();
                  if (!password) {
                    ToastManager.show(
                      {
                        title: 'please input password first',
                      },
                      {
                        type: 'error',
                      },
                    );
                    return;
                  }
                  for (let i = 0; i < 30; i += 1) {
                    const mnemonic =
                      await backgroundApiProxy.engine.generateMnemonic();
                    await backgroundApiProxy.serviceAccount.createHDWallet({
                      password,
                      mnemonic,
                      isAutoAddAllNetworkAccounts: true,
                    });
                    console.log(
                      `Create test wallet (${
                        i + 1
                      }) >>>>>>>>>> mnemonic: ${mnemonic.slice(0, 30)}`,
                    );
                  }
                  ToastManager.show({
                    title: 'Batch create wallets done!',
                  });
                } catch (error) {
                  const e = error as OneKeyError | undefined;
                  console.error(error);

                  let msg = e?.message;
                  if (e?.key) {
                    const id = e?.key as any;
                    const values = e?.info;
                    msg = intl.formatMessage(
                      {
                        id,
                      },
                      values,
                    );
                  }

                  ToastManager.show(
                    {
                      title: msg,
                    },
                    {
                      type: 'error',
                    },
                  );
                }
              }}
            >
              <Typography.Body1>Batch create wallets</Typography.Body1>
            </Pressable>
          </VStack>
        </Box>
      </Box>
    </ScrollView>
  );
};

export default Debug;
