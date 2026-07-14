import { useEffect } from 'react';

import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import hooks from './WalletConnectModal';

const { useModal } = hooks;

export function WalletConnectModalContainer() {
  const { modal, openModal, closeModal } = useModal();

  useEffect(() => {
    const open = async (
      p: IAppEventBusPayload[EAppEventBusNames.WalletConnectOpenModal],
    ) => {
      const { uri, attemptId } = p;

      console.log(
        'WalletConnectModalContainer show qrcode uri: ------------------------ ',
      );
      // the pairing uri query carries the symKey, never log it
      console.log(uri.split('?')[0]);
      console.log('------------------------');

      await openModal({ uri, attemptId });
    };

    const close = async () => {
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
