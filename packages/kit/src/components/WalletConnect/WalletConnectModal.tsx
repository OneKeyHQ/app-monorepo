/* eslint-disable prefer-rest-params */
import { useCallback, useRef } from 'react';

// import { mainnet, solana } from '@reown/appkit/networks';
import { mainnet, solana } from '@reown/appkit/networks';
import { EventsController } from '@reown/appkit-controllers';

import { webFontFamily } from '@onekeyhq/components/src/utils/webFontFamily';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { WALLET_CONNECT_V2_PROJECT_ID } from '@onekeyhq/shared/src/walletConnect/constant';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';

import { createOneKeyAppKit } from './OneKeyAppKitClient';

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
  if (!platformEnv.isExtensionUiPopup) {
    return;
  }
  if (!globalThis.document) return;

  // const qrModal = globalThis.document
  //   ?.querySelector('wcm-modal')
  //   ?.shadowRoot?.querySelector('#wcm-modal .wcm-card wcm-modal-router')
  //   ?.shadowRoot?.querySelector('.wcm-content wcm-connect-wallet-view')
  //   ?.shadowRoot?.querySelector('wcm-desktop-wallet-selection')
  //   ?.shadowRoot?.querySelector('wcm-modal-content wcm-walletconnect-qr') as
  //   | HTMLElement
  //   | undefined;

  const qrModal = globalThis.document
    ?.querySelector('w3m-modal')
    ?.shadowRoot?.querySelector('wui-card w3m-router')
    ?.shadowRoot?.querySelector('w3m-connecting-wc-basic-view')
    ?.shadowRoot?.querySelector('wui-flex w3m-connecting-wc-view')
    ?.shadowRoot?.querySelector('w3m-connecting-wc-qrcode')
    ?.shadowRoot?.querySelector('wui-shimmer') as HTMLElement | undefined;

  if (!qrModal) return;

  /*
  document.querySelector('w3m-modal').shadowRoot.querySelector('wui-card w3m-router').shadowRoot.querySelector('w3m-connecting-wc-basic-view').shadowRoot.querySelector('wui-flex w3m-connecting-wc-view').shadowRoot.querySelector('w3m-connecting-wc-qrcode').shadowRoot.querySelector('wui-qr-code').shadowRoot.querySelector('wui-flex')
  */

  qrModal.style.height = '300px';
  // qrModal.style.width = '300px';
  qrModal.style.display = 'block';
  const qrContainer = qrModal
    ?.querySelector('wui-qr-code')
    ?.shadowRoot?.querySelector?.('wui-flex') as HTMLElement | undefined;

  if (!qrContainer) return;

  qrContainer.style.transform = 'scale(0.85) translate(0, 0)';
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
    // The pairing being opened (pending) vs the pairing the open modal is
    // actually showing (attributed). Close events are blamed on the
    // attributed one, so a stale close from attempt A cannot abort or clear
    // a newer attempt B whose refs were written while A was still closing.
    const pendingUriRef = useRef<string | undefined>(undefined);
    const pendingAttemptIdRef = useRef<number | undefined>(undefined);
    const uriRef = useRef<string | undefined>(undefined);
    const attemptIdRef = useRef<number | undefined>(undefined);
    // Generation-bound queue: each open/close transition runs only after the
    // previous one fully settled, and a queued open superseded by a newer
    // transition is skipped instead of replacing the attempt refs early.
    const transitionGenerationRef = useRef(0);
    const transitionQueueRef = useRef<Promise<void>>(Promise.resolve());

    const enqueueTransition = useCallback((task: () => Promise<void>) => {
      const run = transitionQueueRef.current.then(task);
      transitionQueueRef.current = run.catch(() => undefined);
      return run;
    }, []);

    const openModal = useCallback(
      async ({ uri, attemptId }: { uri: string; attemptId?: number }) => {
        transitionGenerationRef.current += 1;
        const generation = transitionGenerationRef.current;
        const tamaguiWebFontFamily = webFontFamily;
        await enqueueTransition(async () => {
          // a newer open/close claimed the flow while this one was queued
          if (generation !== transitionGenerationRef.current) return;
          pendingUriRef.current = uri;
          pendingAttemptIdRef.current = attemptId;
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
              themeMode: 'dark',
              themeVariables: {
                // https://docs.reown.com/appkit/react/core/theming
                '--w3m-font-family': tamaguiWebFontFamily,
              },
              // debug: true,
              enableInjected: true,
              enableEIP6963: true,
              enableCoinbase: true,
              enableWallets: true,
            });
            modalRef.current.subscribeState(
              (state: PublicStateControllerState) => {
                if (state.open) {
                  // the modal now shows the pending pairing; attribute
                  // subsequent events to it from this point only
                  uriRef.current = pendingUriRef.current;
                  attemptIdRef.current = pendingAttemptIdRef.current;
                }
                // hide connect Dialog loading by eventBus
                appEventBus.emit(EAppEventBusNames.WalletConnectModalState, {
                  open: state.open,
                  attemptId: attemptIdRef.current,
                });
                if (state.open) {
                  updateModalSizeOnExt();
                } else {
                  console.log('WalletConnectModal closed.');
                  const closedUri = uriRef.current;
                  // without an attributed pairing there is nothing to cancel;
                  // an empty uri would wildcard-cancel the active attempt
                  if (closedUri) {
                    void backgroundApiProxy.serviceWalletConnect.abortConnectPairing(
                      {
                        uri: closedUri,
                      },
                    );
                  }
                }
              },
            );
          }
          // await modalRef.current.openModal({
          //   uri,
          // });
          await modalRef.current.open({
            uri,
          });
        });
      },
      [enqueueTransition],
    );

    const closeModal = useCallback(async () => {
      transitionGenerationRef.current += 1;
      await enqueueTransition(async () => {
        if (modalRef.current) {
          // modalRef.current.closeModal();
          await modalRef.current.close();
        }
        // do not set null, subscribeModal will trigger many times, there is no unsubscribe method
        // modalRef.current = null;
      });
    }, [enqueueTransition]);

    return {
      modal: null,
      openModal,
      closeModal,
    };
  },
};

export default modal;
