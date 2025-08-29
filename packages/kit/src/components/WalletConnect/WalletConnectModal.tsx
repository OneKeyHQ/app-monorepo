/* eslint-disable prefer-rest-params */
import { useCallback, useRef } from 'react';

// import { WalletConnectModal } from '@walletconnect/modal';
// import { RouterCtrl } from '@walletconnect/modal-core';
// import { mainnet, solana } from '@reown/appkit/networks';
import { mainnet, solana } from '@reown/appkit/networks';
import { EventsController } from '@reown/appkit-controllers';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { WALLET_CONNECT_V2_PROJECT_ID } from '@onekeyhq/shared/src/walletConnect/constant';

import { createOneKeyAppKit } from './AppKitClient';

import type { IWalletConnectModalShared } from './types';
import type { AppKit, PublicStateControllerState } from '@reown/appkit/core';

if (process.env.NODE_ENV !== 'production') {
  EventsController.subscribe((state) => {
    console.log(
      'Reown AppKit EventsController.subscribe',
      JSON.parse(JSON.stringify(state)),
    );
  });
}

function updateModalSizeOnExtFn() {
  if (!platformEnv.isExtension) {
    return;
  }
  if (!globalThis.document) return;

  const qrModal = globalThis.document
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
// TODO fix ext modal size
// RouterCtrl.subscribe(() => {
//   updateModalSizeOnExt();
// });

const modal: IWalletConnectModalShared = {
  useModal() {
    // const modalRef0 = useRef<WalletConnectModal | null>(null);
    const modalRef = useRef<AppKit | null>(null);
    const openModal = useCallback(async ({ uri }: { uri: string }) => {
      if (!modalRef.current) {
        // modalRef.current = new WalletConnectModal({
        //   projectId: WALLET_CONNECT_V2_PROJECT_ID,
        // });
        // modalRef.current.subscribeModal((state: { open: boolean }) => {
        //   appEventBus.emit(EAppEventBusNames.WalletConnectModalState, state);
        //   if (state.open) {
        //     updateModalSizeOnExt();
        //   }
        // });
        modalRef.current = createOneKeyAppKit({
          projectId: WALLET_CONNECT_V2_PROJECT_ID,
          networks: [mainnet, solana], // show all network matched wallets
          // networks: [] as any,
          universalProvider: {} as any,
          // manualWCControl: true,
        });
        modalRef.current.subscribeState((state: PublicStateControllerState) => {
          // hide connect Dialog loading by eventBus
          appEventBus.emit(EAppEventBusNames.WalletConnectModalState, state);
          if (state.open) {
            updateModalSizeOnExt();
          }
        });
      }
      // await modalRef.current.openModal({
      //   uri,
      // });
      await modalRef.current.open({
        uri,
      });
    }, []);

    const closeModal = useCallback(async () => {
      if (modalRef.current) {
        // modalRef.current.closeModal();
        await modalRef.current.close();
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
