import React, { useCallback, useMemo, useRef, useState } from 'react';

import QRCodeModalWeb from '@walletconnect/qrcode-modal';
import {
  QrcodeModal,
  WalletConnectContext,
  WalletService,
  formatWalletServiceUrl,
  useMobileRegistry,
} from '@walletconnect/react-native-dapp';
import { IQRCodeModal, IWalletConnectSession } from '@walletconnect/types';
import { Linking, Platform } from 'react-native';

import { Box, OverlayContainer } from '@onekeyhq/components';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  ISessionStatusPro,
  WalletConnectClientForDapp,
} from './WalletConnectClientForDapp';
import walletConnectUtils from './walletConnectUtils';

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
const isNativeQrCodeModal = platformEnv.isNative;
// const isNativeQrCodeModal = true;

function getOrCreateClient({
  walletServices,
}: {
  readonly walletServices: WalletService[];
}) {
  if (!clientCache) {
    clientCache = new WalletConnectClientForDapp({ walletServices });
  }
  return clientCache;
}

export function useWalletConnectQrcodeModal() {
  const [state, setState] =
    useState<IWalletConnectQrcodeModalState>(defaultState);
  const clientRef = useRef<WalletConnectClientForDapp | undefined>();

  // TODO cache to simpleDB
  //      https://registry.walletconnect.org/data/wallets.json
  const { error: walletServicesError, data: walletServices } =
    useMobileRegistry();
  const walletServiceRef = useRef<WalletService | undefined>();

  const connectToWalletService = useCallback(
    async (walletService: WalletService, uri?: string) => {
      if (typeof uri !== 'string' || !uri.length) {
        return Promise.reject(new Error('Invalid uri.'));
      }

      const connectionUrl = walletConnectUtils.buildConnectionUrl({
        uri,
        walletService,
      });
      console.log('connectToWalletService ', {
        connectionUrl,
        walletService,
      });
      if (await Linking.canOpenURL(connectionUrl)) {
        walletServiceRef.current = walletService;
        return (
          (await Promise.all([
            // storage.setItem(walletServiceStorageKey, walletService),
            Linking.openURL(connectionUrl),
          ])) && undefined
        );
      }
      return Promise.reject(new Error('Unable to open url.'));
    },
    [],
  );

  // TODO disconnect client and ws transport when Modal close
  const close = useCallback(() => {
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
  }, [setState]);

  const onDismiss = useCallback(() => {
    close();
    (async () => {
      // setConnector(await createConnector(intermediateValue));
    })();
  }, [close]);

  const qrcodeModal: IQRCodeModal = useMemo(() => {
    if (!isNativeQrCodeModal) {
      return {
        ...QRCodeModalWeb,
        close(...args) {
          QRCodeModalWeb.close(...args);
        },
      };
    }

    return {
      // Open QrcodeModal with uri="wc:"
      // @ts-ignore
      async open(uri, cb, opt) {
        console.log('qrcodeModalNative Open >>>>>>>>>>>>>> ', { uri, cb, opt });

        // TODO android auto open apps by uri="wc:" ?
        if (Platform.OS === 'android') {
          const canOpenURL = await Linking.canOpenURL(uri);
          if (canOpenURL) {
            await Linking.openURL(uri);
          } else {
            // url 404 now
            // Linking.openURL('https://walletconnect.org/wallets');
            // throw new Error('No wallets found.');
          }
        }
        setState({
          uri,
          visible: true,
          cb,
        });
        return undefined;
      },
      close() {
        close();
      },
    };
  }, [close]);

  const qrcodeModalElement = useMemo(() => {
    if (!isNativeQrCodeModal) {
      return null;
    }
    // should return null if invisible
    if (!state.visible) {
      return null;
    }
    return (
      <OverlayContainer>
        <Box testID="QrcodeModal-Native">
          <QrcodeModal
            // wallet icon onPress
            connectToWalletService={connectToWalletService}
            walletServices={walletServices}
            visible={state.visible}
            uri={state.uri}
            onDismiss={onDismiss}
            division={4}
            useNativeDriver={false} // Animation driver
            shouldRenderQrcode={false}
          />
        </Box>
      </OverlayContainer>
    );
  }, [
    connectToWalletService,
    onDismiss,
    state.uri,
    state.visible,
    walletServices,
  ]);

  const connectToWallet = useCallback(
    async ({
      isNewSession = false,
      session,
      walletService,
    }: {
      session?: IWalletConnectSession;
      isNewSession?: boolean;
      walletService?: WalletService;
    } = {}) => {
      const services: WalletService[] = walletServices as WalletService[];
      const client = getOrCreateClient({
        walletServices: services || [],
      });
      clientRef.current = client;
      console.log('new WalletConnectClientForDapp() >>>>>>>>  ', client);

      // TODO wait existing session connecting done
      // await delay(3000);

      if (process.env.NODE_ENV !== 'production') {
        // @ts-ignore
        global.$wcClient = client;
      }

      let status: ISessionStatusPro;
      if (isNewSession) {
        status = await client.connectNewSession({ qrcodeModal });
      } else {
        debugLogger.walletConnect.info('connect by session: ', {
          session,
          walletService,
        });
        status = await client.connect({
          // TODO how redirectUrl working?
          session,
          qrcodeModal,
          walletService,
        });
      }

      // TODO check walletService if matched to session
      // update walletService if user choose new wallet
      client.walletService = walletServiceRef.current || walletService;

      // wcClient.disconnect()
      console.log('connectWallet result >>>>> ', status, client.walletService);
      return {
        status,
        session: client.connector?.session,
        client,
        walletService: client.walletService,
      };
    },
    [qrcodeModal, walletServices],
  );

  return {
    // TODO move to context render
    qrcodeModalElement,
    connectToWallet,
    clientRef,
  };
}
