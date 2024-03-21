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
      const { uri } = p;

      console.log(
        'WalletConnectModalContainer show qrcode uri: ------------------------ ',
      );
      console.log(uri);
      console.log('------------------------');

      await openModal({ uri });
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
