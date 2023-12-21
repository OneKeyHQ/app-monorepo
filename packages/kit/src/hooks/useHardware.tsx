import { Dialog } from '@onekeyhq/components';

import {
  ConfirmOnClassic,
  ConfirmPassphrase,
  EnterPassphraseOnDevice,
  EnterPhase,
  EnterPin,
  EnterPinOnDevice,
} from '../components/Hardware';

const mockListenDeviceResult = () => {
  let rejectFunc: () => void | undefined;
  return {
    run: () =>
      new Promise<void>((resolve, reject) => {
        rejectFunc = reject;
        setTimeout(() => {
          resolve();
        }, 3500);
      }),
    cancel: () => {
      if (rejectFunc) {
        rejectFunc();
      }
    },
  };
};

const confirmOnClassic = async () => {
  const event = mockListenDeviceResult();
  const dialog = Dialog.show({
    disableDrag: true,
    dismissOnOverlayPress: false,
    showFooter: false,
    floatingPanelProps: {
      mt: '$5',
      mb: 'auto',
    },
    renderContent: <ConfirmOnClassic />,
    onCancel: () => {
      event.cancel();
    },
  });
  await event.run();
  await dialog.close();
};

const confirmByPin = async () => {
  const event = mockListenDeviceResult();
  const dialog = Dialog.show({
    title: 'Enter PIN',
    showFooter: false,
    renderContent: <EnterPin />,
    onCancel: () => {
      event.cancel();
    },
  });
  await event.run();
  await dialog.close();
};

const confirmPinOnDevice = async () => {
  const event = mockListenDeviceResult();
  const dialog = Dialog.show({
    title: 'Enter PIN on Device',
    showFooter: false,
    renderContent: <EnterPinOnDevice />,
    onCancel: () => {
      event.cancel();
    },
  });
  await event.run();
  await dialog.close();
};

const confirmPhrase = async () => {
  const event = mockListenDeviceResult();
  const dialog = Dialog.show({
    title: 'Enter Passphrase',
    showFooter: false,
    renderContent: <EnterPhase />,
    onCancel: () => {
      event.cancel();
    },
  });
  await event.run();
  await dialog.close();
};

const confirmPhraseOnDevice = async () => {
  const event = mockListenDeviceResult();
  const dialog = Dialog.show({
    title: 'Enter Passphrase on Device',
    showFooter: false,
    renderContent: <EnterPassphraseOnDevice />,
    onCancel: () => {
      event.cancel();
    },
  });
  await event.run();
  await dialog.close();
};

const confirmPassphrase = async () => {
  const event = mockListenDeviceResult();
  const dialog = Dialog.show({
    title: 'Enter Passphrase on Device',
    showFooter: false,
    renderContent: <ConfirmPassphrase />,
    onCancel: () => {
      event.cancel();
    },
  });
  await event.run();
  await dialog.close();
};

export const useConfirmOnHardWare = () => ({
  confirmOnClassic,
  confirmByPin,
  confirmPinOnDevice,
  confirmPhrase,
  confirmPhraseOnDevice,
  confirmPassphrase,
});
