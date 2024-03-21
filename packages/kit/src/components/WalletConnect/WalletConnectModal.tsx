import { useCallback, useRef } from 'react';

import { WalletConnectModal } from '@walletconnect/modal';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { WALLET_CONNECT_V2_PROJECT_ID } from '@onekeyhq/shared/src/walletConnect/constant';

import type { IWalletConnectModalShared } from './types';

const modal: IWalletConnectModalShared = {
  useModal() {
    const modalRef = useRef<WalletConnectModal | null>(null);
    const openModal = useCallback(async ({ uri }: { uri: string }) => {
      if (!modalRef.current) {
        modalRef.current = new WalletConnectModal({
          projectId: WALLET_CONNECT_V2_PROJECT_ID,
        });
        modalRef.current.subscribeModal((state: { open: boolean }) =>
          appEventBus.emit(EAppEventBusNames.WalletConnectModalState, state),
        );
      }
      await modalRef.current.openModal({
        uri,
      });
    }, []);

    const closeModal = useCallback(() => {
      if (modalRef.current) {
        modalRef.current.closeModal();
      }
      // do not set null, subscribeModal will trigger many times, there is no unsubscribe method
      // modalRef.current = null;
    }, []);

    return {
      modal: null,
      openModal,
      closeModal,
    };
  },
};

export default modal;
