/* eslint-disable import/order */
import '@walletconnect/react-native-compat';

import { useCallback, useEffect, useRef, useState } from 'react';

import { AccountCtrl } from '@walletconnect/modal-react-native/lib/module/controllers/AccountCtrl';
import { ClientCtrl } from '@walletconnect/modal-react-native/lib/module/controllers/ClientCtrl';
import { WcConnectionCtrl } from '@walletconnect/modal-react-native/lib/module/controllers/WcConnectionCtrl';
import { useWalletConnectModal } from '@walletconnect/modal-react-native/lib/module/hooks/useWalletConnectModal';
import { WalletConnectModalDialog as WalletConnectModalNative } from './WalletConnectModalDialog';
import { StorageUtil } from '@walletconnect/modal-react-native/lib/module/utils/StorageUtil';

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

import type { IWalletConnectModalShared } from './types';

// https://docs.walletconnect.com/advanced/walletconnectmodal/usage
// https://github.com/WalletConnect/react-native-examples/blob/main/dapps/ModalUProvider/src/App.tsx
function NativeModal() {
  const { open: openNativeModal } = useWalletConnectModal();

  // TODO call ClientCtrl.setProvider first, then render Modal, openNativeModal
  console.log('NativeModal openNativeModal: ', openNativeModal);
  return (
    <WalletConnectModalNative
      projectId={WALLET_CONNECT_V2_PROJECT_ID}
      providerMetadata={WALLET_CONNECT_CLIENT_META}
    />
  );
}

const modal: IWalletConnectModalShared = {
  useModal() {
    const {
      open: openNativeModal,
      isOpen: isNativeModalOpen,
      close: closeNativeModal,
      provider: nativeProvider,
    } = useWalletConnectModal();

    const nativeProviderRef = useRef(nativeProvider);
    nativeProviderRef.current = nativeProvider;
    const openNativeModalRef = useRef(openNativeModal);
    openNativeModalRef.current = openNativeModal;
    const closeNativeModalRef = useRef(closeNativeModal);
    closeNativeModalRef.current = closeNativeModal;

    console.log('isNativeModalOpen', isNativeModalOpen);

    const resetApp = useCallback(async () => {
      ClientCtrl.resetSession();
      AccountCtrl.resetAccount();
      WcConnectionCtrl.resetConnection();
      await StorageUtil.removeDeepLinkWallet();
    }, []);
    const resetAppRef = useRef(resetApp);
    resetAppRef.current = resetApp;

    const [shouldRenderNativeModal, setShouldRenderNativeModal] =
      useState(false);

    const openModal = useCallback(async ({ uri }: { uri: string }) => {
      await resetAppRef.current();
      // WalletConnectModal -> useConfigure -> initProvider()
      WcConnectionCtrl.setPairingUri(uri); // onDisplayUri
      // import { ClientCtrl } from '@walletconnect/modal-react-native/lib/module/controllers/ClientCtrl';
      // TODO use custom provider from bg make QRCode Modal not open automatically
      ClientCtrl.setProvider({} as any);
      // resetApp(); // onSessionDelete
      ClientCtrl.setInitialized(true);

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
      await openNativeModalRef.current(); // show modal

      // await openNativeModal({
      //   route: 'ConnectWallet',
      // });
    }, []);

    const closeModal = useCallback(() => {
      closeNativeModalRef.current();
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
      modal: shouldRenderNativeModal ? <NativeModal /> : null,
      openModal,
      closeModal,
    };
  },
};

export default modal;
