import { useEffect, useRef } from 'react';

import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { acquireReplayPause } from '@onekeyhq/shared/src/modules3rdParty/posthog/replayGate';

import hooks from './WalletConnectModal';

const { useModal } = hooks;

export function WalletConnectModalContainer() {
  const { modal, openModal, closeModal } = useModal();
  const activeAttemptIdRef = useRef<number | undefined>(undefined);
  // The AppKit modal shows the pairing QR (it carries the symKey). Pause
  // replay synchronously before it opens and until it reports closed.
  const releaseReplayPauseRef = useRef<(() => void) | undefined>(undefined);

  useEffect(
    () => () => {
      releaseReplayPauseRef.current?.();
      releaseReplayPauseRef.current = undefined;
    },
    [],
  );

  useEffect(() => {
    let openSequence = 0;
    const holdReplayPause = (hold: boolean) => {
      if (hold) {
        releaseReplayPauseRef.current ??=
          acquireReplayPause('walletConnectModal');
        return;
      }
      releaseReplayPauseRef.current?.();
      releaseReplayPauseRef.current = undefined;
    };

    const open = async (
      p: IAppEventBusPayload[EAppEventBusNames.WalletConnectOpenModal],
    ) => {
      const { uri, attemptId } = p;
      activeAttemptIdRef.current = attemptId;
      openSequence += 1;
      holdReplayPause(true);

      console.log(
        'WalletConnectModalContainer show qrcode uri: ------------------------ ',
      );
      // the pairing uri query carries the symKey, never log it
      console.log(uri.split('?')[0]);
      console.log('------------------------');

      try {
        await openModal({ uri, attemptId });
      } catch (error) {
        // No modal state event follows a failed open.
        holdReplayPause(false);
        throw error;
      }
    };

    const close = async (
      p: IAppEventBusPayload[EAppEventBusNames.WalletConnectCloseModal],
    ) => {
      // A stale attempt-scoped close must not tear down the modal already
      // showing a newer pairing, nor invalidate its in-flight open request.
      // Closes without attemptId remain wildcard closes.
      if (
        p?.attemptId &&
        activeAttemptIdRef.current &&
        p.attemptId !== activeAttemptIdRef.current
      ) {
        return;
      }
      // A close that supersedes a queued open emits no state event; release
      // once the close settles, unless a newer open started meanwhile.
      const sequenceAtClose = openSequence;
      void Promise.resolve(closeModal()).finally(() => {
        if (openSequence === sequenceAtClose) {
          holdReplayPause(false);
        }
      });
    };

    const onModalState = (
      p: IAppEventBusPayload[EAppEventBusNames.WalletConnectModalState],
    ) => {
      holdReplayPause(!!p?.open);
    };

    appEventBus.on(EAppEventBusNames.WalletConnectOpenModal, open);
    appEventBus.on(EAppEventBusNames.WalletConnectCloseModal, close);
    appEventBus.on(EAppEventBusNames.WalletConnectModalState, onModalState);

    return () => {
      appEventBus.off(EAppEventBusNames.WalletConnectOpenModal, open);
      appEventBus.off(EAppEventBusNames.WalletConnectCloseModal, close);
      appEventBus.off(EAppEventBusNames.WalletConnectModalState, onModalState);
    };
  }, [closeModal, openModal]);

  return modal;
}
