import { useCallback, useRef } from 'react';

import { WalletConnectModal } from '@walletconnect/modal';
import { RouterCtrl } from '@walletconnect/modal-core';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { WALLET_CONNECT_V2_PROJECT_ID } from '@onekeyhq/shared/src/walletConnect/constant';

import type { IWalletConnectModalShared } from './types';

function updateModalSizeOnExtFn() {
  if (!platformEnv.isExtension) {
    return;
  }
  if (!global.document) return;

  const qrModal = global.document
    ?.querySelector('wcm-modal')
    ?.shadowRoot?.querySelector('#wcm-modal .wcm-card wcm-modal-router')
    ?.shadowRoot?.querySelector('.wcm-content wcm-connect-wallet-view')
    ?.shadowRoot?.querySelector('wcm-desktop-wallet-selection')
    ?.shadowRoot?.querySelector('wcm-modal-content wcm-walletconnect-qr') as
    | HTMLElement
    | undefined;

  if (!qrModal) return;

  qrModal.style.height = '270px';
  qrModal.style.display = 'block';
  const qrContainer = qrModal.shadowRoot?.querySelector('.wcm-qr-container') as
    | HTMLElement
    | undefined;

  if (!qrContainer) return;

  qrContainer.style.transform = 'scale(0.85) translate(0, -40px)';
}

function updateModalSizeOnExt() {
  setTimeout(() => {
    updateModalSizeOnExtFn();
  }, 0);
  setTimeout(() => {
    updateModalSizeOnExtFn();
  }, 260);
  setTimeout(() => {
    updateModalSizeOnExtFn();
  }, 600);
}

RouterCtrl.subscribe(() => {
  updateModalSizeOnExt();
});

const modal: IWalletConnectModalShared = {
  useModal() {
    const modalRef = useRef<WalletConnectModal | null>(null);
    const openModal = useCallback(async ({ uri }: { uri: string }) => {
      if (!modalRef.current) {
        modalRef.current = new WalletConnectModal({
          projectId: WALLET_CONNECT_V2_PROJECT_ID,
        });
        modalRef.current.subscribeModal((state: { open: boolean }) => {
          appEventBus.emit(EAppEventBusNames.WalletConnectModalState, state);
          if (state.open) {
            updateModalSizeOnExt();
          }
        });
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
