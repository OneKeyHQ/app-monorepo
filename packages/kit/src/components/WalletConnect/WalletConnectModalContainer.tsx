import { useEffect, useRef } from 'react';

import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import hooks from './WalletConnectModal';

const { useModal } = hooks;

export function WalletConnectModalContainer() {
  const { modal, openModal, closeModal } = useModal();
  const activeAttemptIdRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const open = async (
      p: IAppEventBusPayload[EAppEventBusNames.WalletConnectOpenModal],
    ) => {
      const { uri, attemptId } = p;
      activeAttemptIdRef.current = attemptId;

      console.log(
        'WalletConnectModalContainer show qrcode uri: ------------------------ ',
      );
      // the pairing uri query carries the symKey, never log it
      console.log(uri.split('?')[0]);
      console.log('------------------------');

      await openModal({ uri, attemptId });
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
      closeModal();
    };

    appEventBus.on(EAppEventBusNames.WalletConnectOpenModal, open);
    appEventBus.on(EAppEventBusNames.WalletConnectCloseModal, close);

    return () => {
      appEventBus.off(EAppEventBusNames.WalletConnectOpenModal, open);
      appEventBus.off(EAppEventBusNames.WalletConnectCloseModal, close);
    };
  }, [closeModal, openModal]);

  return modal;
}
