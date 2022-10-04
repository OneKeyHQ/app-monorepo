// eslint-disable-next-line @typescript-eslint/no-unused-vars
import React, { useCallback, useRef, useState } from 'react';

import QRCodeModalWeb from '@walletconnect/qrcode-modal';
import {
  IClientMeta,
  IQRCodeModal,
  IWalletConnectSession,
} from '@walletconnect/types';
import { Linking } from 'react-native';

import useModalClose from '@onekeyhq/components/src/Modal/Container/useModalClose';
import { copyToClipboard } from '@onekeyhq/components/src/utils/ClipboardUtils';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../hooks/useAppNavigation';
import {
  CreateWalletModalRoutes,
  ModalRoutes,
  RootRoutes,
} from '../../routes/routesEnum';
import { wait } from '../../utils/helper';

import { WalletService } from './types';
import walletConnectUtils from './utils/walletConnectUtils';
import {
  ISessionStatusPro,
  WalletConnectClientForDapp,
} from './WalletConnectClientForDapp';
import {
  WALLET_CONNECT_IS_NATIVE_QRCODE_MODAL,
  WALLET_CONNECT_OPEN_WALLET_APP_DELAY,
  WALLET_CONNECT_WALLETS_LIST,
} from './walletConnectConsts';

export type IWalletConnectQrcodeModalState = {
  visible: boolean;
  uri?: string;
  cb?: () => any;
};
const defaultState: IWalletConnectQrcodeModalState = Object.freeze({
  visible: false,
  uri: undefined,
  cb: undefined,
});

let clientCache: WalletConnectClientForDapp | undefined;

function getOrCreateClient() {
  if (!clientCache) {
    clientCache = new WalletConnectClientForDapp();
  }
  return clientCache;
}

export function useWalletConnectQrcodeModal() {
  const { serviceWalletConnect } = backgroundApiProxy;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [state, setState] =
    useState<IWalletConnectQrcodeModalState>(defaultState);
  const clientRef = useRef<WalletConnectClientForDapp | undefined>();
  const navigation = useAppNavigation();
  const closeModal = useModalClose({ fallbackToHome: false });

  const walletServiceSelectedInModalRef = useRef<WalletService | undefined>();

  // node_modules/@walletconnect/react-native-dapp/dist/providers/WalletConnectProvider.js
  //    const connectToWalletService = React.useCallback(async (walletService, uri)
  //    const open = React.useCallback(async (uri, cb) =>
  const connectToWalletService = useCallback(
    async (walletService: WalletService, uri?: string) => {
      if (typeof uri !== 'string' || !uri.length) {
        return Promise.reject(new Error('Invalid uri.'));
      }

      const connectionUrl = walletConnectUtils.buildConnectWalletAppUrl({
        uri,
        walletService,
      });

      debugLogger.walletConnect.info('connectToWalletService', {
        uri,
        connectionUrl,
        walletServiceUrl: walletService?.homepage,
      });
      try {
        if (platformEnv.isNative) {
          // add some delay to make sure connection uri message has been sent to wallet app by websocket
          await wait(WALLET_CONNECT_OPEN_WALLET_APP_DELAY);
        }
        let canOpenURL = false;
        let openConnectionUrl = connectionUrl;

        if (platformEnv.isNativeAndroid) {
          try {
            openConnectionUrl = uri;
            canOpenURL = await Linking.canOpenURL(openConnectionUrl);
          } catch (error) {
            debugLogger.common.error(error);
          }
        }

        if (!canOpenURL) {
          try {
            openConnectionUrl = connectionUrl;
            canOpenURL = await Linking.canOpenURL(openConnectionUrl);
          } catch (error) {
            debugLogger.common.error(error);
          }
        }

        debugLogger.walletConnect.info('Linking.openURL(connectionUrl)', {
          openConnectionUrl,
          canOpenURL,
        });
        if (platformEnv.isDev) {
          copyToClipboard(openConnectionUrl);
        }

        walletServiceSelectedInModalRef.current = walletService;

        if (!canOpenURL) {
          if (platformEnv.isNativeAndroid) {
            Linking.openURL('https://walletconnect.org/wallets');
            throw new Error('No wallets found.');
          }
          throw new Error(
            `Unable to open deeplink url, make sure you have added scheme to LSApplicationQueriesSchemes in your iOS Info.plist and the target Apps is installed. >>>> ${openConnectionUrl}`,
          );
        }

        if (platformEnv.isNativeAndroid) {
          // openUrl('https://www.baidu.com');
          // openUrl(openConnectionUrl); // webview not working for wc:
          // openUrlExternal('https://www.baidu.com');
          // setTimeout(() => {
          //   openUrlExternal(openConnectionUrl);
          // }, 1000);
          // navigation.navigate(RootRoutes.Root, {
          //   screen: HomeRoutes.SettingsWebviewScreen,
          //   params: {
          //     url: 'https://www.baidu.com', // openConnectionUrl,
          //     title: '',
          //   },
          // });
          // return;
        }
        return (
          (await Promise.all([
            // storage.setItem(walletServiceStorageKey, walletService),
            Linking.openURL(openConnectionUrl),
          ])) && undefined
        );
      } catch (error) {
        debugLogger.common.error(error);
        return Promise.reject(error);
      }
    },
    [],
  );

  const isClosedRef = useRef(false);
  // TODO disconnect client and ws transport when Modal close
  const close = useCallback(
    ({
      walletServiceForConnectDirectly,
    }: {
      walletServiceForConnectDirectly?: WalletService;
    } = {}) => {
      if (isClosedRef.current) {
        return;
      }
      debugLogger.walletConnect.info(
        'useWalletConnectQrcodeModal onDismiss closed',
      );
      isClosedRef.current = true;
      if (!walletServiceForConnectDirectly) {
        closeModal();
      }
      setState((currentState) => {
        // cb will trigger `modal_closed` event in Connector
        const { cb } = currentState;
        setTimeout(() => {
          // call modal open cb in Connector: trigger `modal_closed` event
          if (typeof cb === 'function' && cb) {
            cb();
          }
        }, 0);
        return {
          visible: false,
          uri: undefined,
          cb: undefined,
        };
      });
      return undefined;
    },
    [closeModal],
  );

  const onDismiss = useCallback(() => {
    close();
    (async () => {
      // setConnector(await createConnector(intermediateValue));
    })();
  }, [close]);

  const createQrcodeModalApi = useCallback(
    async ({
      walletServiceForConnectDirectly,
    }: {
      walletServiceForConnectDirectly?: WalletService;
    } = {}): Promise<IQRCodeModal> => {
      await wait(0);
      // QRCodeModalWeb
      if (!WALLET_CONNECT_IS_NATIVE_QRCODE_MODAL) {
        return {
          ...QRCodeModalWeb,
          close(...args: any[]) {
            // @ts-ignore
            QRCodeModalWeb.close(...args);
          },
        };
      }

      // QRCodeModalNative
      return {
        // Open QrcodeModal with uri="wc:"
        // @ts-ignore
        async open(uri, cb, opt) {
          debugLogger.walletConnect.info(
            'qrcodeModalNative Open >>>>>>>>>>>>>> ',
            {
              uri,
              opt,
            },
          );
          isClosedRef.current = false;

          // ** Android should open apps by uri="wc:"
          if (platformEnv.isNativeAndroid) {
            // add some delay to make sure connection uri message has been sent to wallet app by websocket
            await wait(WALLET_CONNECT_OPEN_WALLET_APP_DELAY);
            const canOpenURL = await Linking.canOpenURL(uri);
            if (canOpenURL) {
              await Linking.openURL(uri);
            } else {
              // url 404 now
              await Linking.openURL(WALLET_CONNECT_WALLETS_LIST);
              throw new Error('No wallets found.');
            }
            return;
          }

          // ** iOS can open matched apps directly
          if (walletServiceForConnectDirectly) {
            await connectToWalletService(walletServiceForConnectDirectly, uri);
          } else {
            // open wallets list Modal
            navigation.navigate(RootRoutes.Modal, {
              screen: ModalRoutes.CreateWallet,
              params: {
                screen: CreateWalletModalRoutes.WalletConnectQrcodeModal,
                // close button, secondary button, backdrop click, gesture, useEffect destroy
                params: {
                  connectToWalletService,
                  uri,
                  onDismiss,
                  shouldRenderQrcode: false,
                },
              },
            });
          }
          // await wait(5000);
          // close();

          setState({
            visible: false,
            uri,
            cb,
          });
          return undefined;
        },
        close() {
          close({ walletServiceForConnectDirectly });
        },
      };
    },
    [close, connectToWalletService, navigation, onDismiss],
  );

  const connectToWallet = useCallback(
    async ({
      isNewSession = false,
      session,
      walletService,
      accountId,
    }: {
      session?: IWalletConnectSession;
      isNewSession?: boolean;
      walletService?: WalletService;
      accountId?: string;
    } = {}) => {
      const client = getOrCreateClient();
      clientRef.current = client;
      walletServiceSelectedInModalRef.current = undefined;

      // TODO wait existing session connecting done
      // await delay(3000);

      if (process.env.NODE_ENV !== 'production') {
        // @ts-ignore
        global.$wcClient = client;
      }

      const qrcodeModal = await createQrcodeModalApi({
        walletServiceForConnectDirectly: walletService,
      });
      let status: ISessionStatusPro;
      if (isNewSession) {
        debugLogger.walletConnect.info('connect NEW session: ', {
          walletServiceUrl: walletService?.homepage,
        });
        status = await client.connectNewSession({ qrcodeModal });
      } else {
        debugLogger.walletConnect.info('connect EXISTS session: ', {
          sessionPeerMeta: session?.peerMeta,
          walletServiceUrl: walletService?.homepage,
        });
        status = await client.connect({
          // TODO how redirectUrl working?
          session,
          qrcodeModal,
          walletService,
        });
      }
      const finalSession = client.connector?.session;

      // Android should detect the walletService by peer session, ignore user selected wallet in Modal
      if (platformEnv.isNativeAndroid) {
        client.walletService = walletService;
      } else {
        // iOS should update walletService if user selected wallet in Modal
        client.walletService =
          walletServiceSelectedInModalRef.current ?? walletService;
      }

      if (!client.walletService && finalSession) {
        client.walletService =
          await serviceWalletConnect.findWalletServiceBySession({
            session: finalSession,
          });
      }

      const finalWalletService = client.walletService;

      if (accountId) {
        client.watchAccountSessionChanged({ accountId });
        if (finalSession) {
          await client.saveAccountSession({
            accountId,
            session: finalSession,
          });
        }
      }

      // wcClient.disconnect()
      debugLogger.walletConnect.info('connectToWallet result >>>>> ', {
        status,
        walletServiceUrl: finalWalletService?.homepage,
      });

      return {
        status,
        session: finalSession,
        client,
        walletService: finalWalletService,
      };
    },
    [createQrcodeModalApi, serviceWalletConnect],
  );

  return {
    connectToWallet,
    clientRef,
  };
}

export type IConnectToWalletResult = {
  status: ISessionStatusPro;
  session:
    | {
        connected: boolean;
        accounts: string[];
        chainId: number;
        bridge: string;
        key: string;
        clientId: string;
        clientMeta: IClientMeta | null;
        peerId: string;
        peerMeta: IClientMeta | null;
        handshakeId: number;
        handshakeTopic: string;
      }
    | undefined;
  client: WalletConnectClientForDapp;
  walletService: WalletService | undefined;
};
