/* eslint-disable import/order */
import '@walletconnect/react-native-compat'; // polyfill for react-native

import { memo, useCallback, useEffect, useRef, useState } from 'react';

import { ConstantsUtil } from '@reown/appkit-common-react-native';

import {
  AppKit as AppKitModalNative,
  createAppKit,
  useAppKit,
  useAppKitState,
} from '@reown/appkit-ethers5-react-native';
import {
  EthersConstantsUtil,
  EthersStoreUtil,
  StorageUtil,
} from '@reown/appkit-scaffold-utils-react-native';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import {
  WALLET_CONNECT_CLIENT_META,
  WALLET_CONNECT_V2_PROJECT_ID,
} from '@onekeyhq/shared/src/walletConnect/constant';

import type { IOneKeyError } from '@onekeyhq/shared/src/errors/types/errorTypes';
import type { IWalletConnectSession } from '@onekeyhq/shared/src/walletConnect/types';
import type { IWalletConnectModalShared } from './types';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { ConstantsUtil as ConstantsUtilCore } from '@reown/appkit/core';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { StorageUtil as StorageUtilCore } from '@reown/appkit-core-react-native';

/*
WalletConnect SDK Deeplink Auto-Handling Mechanism:

This system automatically manages deeplinks for external wallet apps in two key scenarios:

1. 🔗 Wallet Connection Phase (reown-appkit-react-native):
   • When user clicks a wallet icon in the connection modal
   • The wallet's deeplink is automatically stored for future use
   • Implementation:
     - File: packages/scaffold/src/utils/UiUtil.ts
     - Method: StorageUtil.setWalletConnectDeepLink(wcLinking)
     - Storage: AsyncStorage.setItem('WALLETCONNECT_DEEPLINK_CHOICE', wcLinking)

2. 🚀 Transaction/Signing Phase (walletconnect-monorepo):
   • When sending transactions or signing messages
   • Previously stored deeplink is retrieved and used to launch the wallet app
   • Implementation:
     - Provider: providers/ethereum-provider/src/EthereumProvider.ts (request method)
     - Engine: packages/sign-client/src/controllers/engine.ts
     - Retrieval: getDeepLink(storage, 'WALLETCONNECT_DEEPLINK_CHOICE')

This ensures seamless user experience by automatically launching the correct wallet app.
*/

const appKit = createAppKit({
  projectId: WALLET_CONNECT_V2_PROJECT_ID,
  metadata: WALLET_CONNECT_CLIENT_META,
  config: {
    metadata: WALLET_CONNECT_CLIENT_META,
  },
  chains: [],
});
let pairingUri = '';
let updateConnectModalUri: (uri: string) => void = (uri: string) => {
  console.log('updateConnectModalUri-init-fn', uri);
};
let resolveConnect: (session: IWalletConnectSession) => void = () => {};
let rejectConnect: (error: IOneKeyError) => void = () => {};
// @ts-ignore
appKit.walletConnectProvider = {
  on(event: string, callback: (uri: string) => void) {
    updateConnectModalUri = callback;
    if (pairingUri && event === 'display_uri') {
      callback(pairingUri);
    }
  },
  async connect() {
    return new Promise((resolve, reject) => {
      resolveConnect = resolve;
      rejectConnect = reject;
    });
  },
  signer: {
    client: {
      core: {
        crypto: {
          getClientId() {
            console.log('WalletConnectModalNative getClientId');
            return undefined;
          },
        },
      },
    },
  },
};

async function resetAppKit() {
  pairingUri = '';
  // await appKitModalCtrl.disconnect();

  // ClientCtrl.resetSession();
  // AccountCtrl.resetAccount();
  // WcConnectionCtrl.resetConnection();

  // void StorageUtil.setItem(
  //   EthersConstantsUtil.WALLET_ID,
  //   ConstantsUtil.WALLET_CONNECT_CONNECTOR_ID,
  // );
  void StorageUtil.removeItem(EthersConstantsUtil.WALLET_ID);
  // void StorageUtilCore.removeWalletConnectDeepLink();

  EthersStoreUtil.reset();
  // @ts-ignore
  appKit.setClientId(null);
  appKit.setAddress(undefined);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function setMockedProviderConnected() {
  void StorageUtil.removeItem(EthersConstantsUtil.WALLET_ID);

  EthersStoreUtil.reset();
  // @ts-ignore
  appKit.setClientId(null);
  appKit.setAddress(undefined);
}

async function setMockedProviderConnectedV2() {
  void StorageUtil.setItem(
    EthersConstantsUtil.WALLET_ID,
    ConstantsUtil.WALLET_CONNECT_CONNECTOR_ID,
  );

  EthersStoreUtil.setIsConnected(true);
}

// @ts-ignore
appKit.setWalletConnectProvider = async () => {
  console.log('setWalletConnectProvider mocked');

  // void setMockedProviderConnected();
  void setMockedProviderConnectedV2();
};

appEventBus.on(
  EAppEventBusNames.WalletConnectConnectSuccess,
  (payload: { session: IWalletConnectSession }) => {
    const { session } = payload;
    resolveConnect(session);
  },
);
appEventBus.on(
  EAppEventBusNames.WalletConnectConnectError,
  (payload: { error: IOneKeyError }) => {
    const { error } = payload;
    rejectConnect(error);
  },
);

function useWalletConnectModal() {
  const { open: isNativeModalOpen, selectedNetworkId } = useAppKitState();
  const { open: openNativeModal, close: closeNativeModal } = useAppKit();
  return {
    isNativeModalOpen,
    openNativeModal,
    closeNativeModal,
    selectedNetworkId,
  };
}

// appKitModalCtrl.open();
// appKitModalCtrl.close();

// https://docs.walletconnect.com/advanced/walletconnectmodal/usage
// https://github.com/WalletConnect/react-native-examples/blob/main/dapps/ModalUProvider/src/App.tsx
function NativeModal() {
  // const { open: openNativeModal, isOpen: isNativeModalOpen } =
  //   useWalletConnectModal();
  const {
    isNativeModalOpen,
    selectedNetworkId,
    openNativeModal,
    closeNativeModal,
  } = useWalletConnectModal();
  const [isMounted, setIsMounted] = useState(false);

  // TODO call ClientCtrl.setProvider first, then render Modal, openNativeModal
  console.log('NativeModal openNativeModal fn: ', openNativeModal);
  console.log('NativeModal closeNativeModal fn: ', closeNativeModal);
  console.log('NativeModal isNativeModalOpen : ', isNativeModalOpen);
  console.log('NativeModal selectedNetworkId : ', selectedNetworkId);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isNativeModalOpen && isMounted) {
    // Avoid waking up the external wallet App twice
    return null;
  }

  return <AppKitModalNative />;
}

const NativeModalMemo = memo(NativeModal);

const modal: IWalletConnectModalShared = {
  useModal() {
    const {
      openNativeModal,
      isNativeModalOpen,
      closeNativeModal,
      // provider: nativeProvider,
    } = useWalletConnectModal();

    // const nativeProviderRef = useRef(nativeProvider);
    // nativeProviderRef.current = nativeProvider;
    const openNativeModalRef = useRef(openNativeModal);
    openNativeModalRef.current = openNativeModal;
    const closeNativeModalRef = useRef(closeNativeModal);
    closeNativeModalRef.current = closeNativeModal;

    console.log('isNativeModalOpen', isNativeModalOpen);

    const [shouldRenderNativeModal, setShouldRenderNativeModal] =
      useState(false);

    const openModal = useCallback(async ({ uri }: { uri: string }) => {
      await resetAppKit();
      pairingUri = uri;
      updateConnectModalUri(uri);

      // TODO use custom provider from bg make QRCode Modal not open automatically
      // ClientCtrl.setProvider({} as any);
      // // resetApp(); // onSessionDelete
      // ClientCtrl.setInitialized(true);

      setShouldRenderNativeModal(true);

      // try {
      //   await nativeProviderRef.current?.disconnect();
      // } catch (error) {
      //   console.error(error);
      // }

      await timerUtils.wait(600); // wait modal render done

      console.log(
        'WalletConnectModalContainer openNativeModalRef: ------------------------ ',
      );
      await openNativeModalRef.current({
        view: 'Connect',
      }); // show modal

      // await openNativeModal({
      //   route: 'ConnectWallet',
      // });
    }, []);

    const closeModal = useCallback(async () => {
      await closeNativeModalRef.current();
    }, []);

    useEffect(() => {
      void (async () => {
        if (platformEnv.isNative) {
          if (!isNativeModalOpen) {
            await resetAppKit();
            console.log('setShouldRenderNativeModal false');
            // setShouldRenderNativeModal(false);
          }
          appEventBus.emit(EAppEventBusNames.WalletConnectModalState, {
            open: isNativeModalOpen,
          });
        }
      })();
    }, [isNativeModalOpen]);

    return {
      modal: shouldRenderNativeModal ? <NativeModalMemo /> : null,
      openModal,
      closeModal,
    };
  },
};

export default modal;
