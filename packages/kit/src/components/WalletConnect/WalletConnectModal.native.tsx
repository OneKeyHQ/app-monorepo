/* eslint-disable import/order */
import '@walletconnect/react-native-compat'; // polyfill for react-native

import { memo, useCallback, useEffect, useRef, useState } from 'react';

import { StorageUtil as StorageUtilCore } from '@reown/appkit-core-react-native';
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
  void StorageUtilCore.removeWalletConnectDeepLink();

  // void StorageUtil.setItem(
  //   EthersConstantsUtil.WALLET_ID,
  //   ConstantsUtil.WALLET_CONNECT_CONNECTOR_ID,
  // );
  void StorageUtil.removeItem(EthersConstantsUtil.WALLET_ID);

  EthersStoreUtil.reset();
  // @ts-ignore
  appKit.setClientId(null);
  appKit.setAddress(undefined);
}

async function setMockedProviderConnected() {
  void StorageUtil.removeItem(EthersConstantsUtil.WALLET_ID);

  EthersStoreUtil.reset();
  // @ts-ignore
  appKit.setClientId(null);
  appKit.setAddress(undefined);
}

// @ts-ignore
appKit.setWalletConnectProvider = async () => {
  console.log('setWalletConnectProvider mocked');

  void setMockedProviderConnected();
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

    const resetAppRef = useRef(resetAppKit);
    resetAppRef.current = resetAppKit;

    const [shouldRenderNativeModal, setShouldRenderNativeModal] =
      useState(false);

    const openModal = useCallback(async ({ uri }: { uri: string }) => {
      await resetAppRef.current();
      pairingUri = uri;
      updateConnectModalUri(uri);

      // import { ClientCtrl } from '@walletconnect/modal-react-native/lib/module/controllers/ClientCtrl';
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
            await resetAppRef.current();
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
