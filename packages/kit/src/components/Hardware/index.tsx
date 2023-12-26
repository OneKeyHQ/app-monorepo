import { useCallback } from 'react';

import { Dialog, Toast } from '@onekeyhq/components';

import {
  ConfirmOnClassic,
  ConfirmPassphrase,
  EnterPassphraseOnDevice,
  EnterPhase,
  EnterPin,
  EnterPinOnDevice,
} from './Hardware';

const mockListenDeviceResult = () => {
  const actions: (() => void | undefined)[] = [];
  return {
    run: () =>
      new Promise<void>((resolve, reject) => {
        actions[0] = resolve;
        actions[1] = reject;
      }),
    confirm: () => {
      actions?.[0]();
    },
    cancel: () => {
      actions?.[1]();
    },
  };
};

export const confirmOnClassic = async () => {
  const event = mockListenDeviceResult();
  // const dialog = Dialog.show({
  //   disableDrag: true,
  //   dismissOnOverlayPress: false,
  //   showFooter: false,
  //   floatingPanelProps: {
  //     mt: '$5',
  //     mb: 'auto',
  //   },
  //   renderContent: <ConfirmOnClassic />,
  //   onDismiss: () => {
  //     event.cancel();
  //   },
  // });
  // setTimeout(async () => {
  //   event.confirm();
  //   await dialog.close();
  // }, 3500);
  // await event.run();
  const toast = Toast.show({
    children: <ConfirmOnClassic />,
  });
  setTimeout(() => {
    void toast.close();
  }, 9999999);
};

export const confirmPinOnDevice = async () => {
  const event = mockListenDeviceResult();
  const dialog = Dialog.show({
    title: 'Enter PIN on Device',
    showFooter: false,
    renderContent: <EnterPinOnDevice />,
    onCancel: () => {
      event.cancel();
    },
  });
  setTimeout(async () => {
    event.confirm();
    await dialog.close();
  }, 3500);
  await event.run();
};

export const confirmByPin = async () => {
  const event = mockListenDeviceResult();
  const dialog = Dialog.show({
    title: 'Enter PIN',
    showFooter: false,
    renderContent: (
      <EnterPin
        onConfirm={async () => {
          event.confirm();
          await dialog.close();
        }}
        switchOnDevice={async () => {
          await dialog.close();
          await confirmPinOnDevice();
        }}
      />
    ),
    onDismiss: () => {
      event.cancel();
    },
  });
  await event.run();
};

export const confirmPhraseOnDevice = async () => {
  const event = mockListenDeviceResult();
  Dialog.show({
    title: 'Enter Passphrase on Device',
    showFooter: false,
    renderContent: <EnterPassphraseOnDevice />,
    onCancel: () => {
      event.cancel();
    },
  });
  await event.run();
};

export const confirmPhrase = async () => {
  const event = mockListenDeviceResult();
  const dialog = Dialog.show({
    title: 'Enter Passphrase',
    showFooter: false,
    renderContent: (
      <EnterPhase
        onConfirm={async () => {
          event.confirm();
          await dialog.close();
        }}
        switchOnDevice={async () => {
          await dialog.close();
          await confirmPhraseOnDevice();
        }}
      />
    ),
    onCancel: () => {
      event.cancel();
    },
  });
  await event.run();
};

export const confirmPassphrase = async () => {
  const event = mockListenDeviceResult();
  const dialog = Dialog.show({
    title: 'Confirm Passphrase',
    showFooter: false,
    renderContent: (
      <ConfirmPassphrase
        onConfirm={async () => {
          event.confirm();
          await dialog.close();
        }}
        switchOnDevice={async () => {
          await dialog.close();
          await confirmPhraseOnDevice();
        }}
      />
    ),
    onCancel: () => {
      event.cancel();
    },
  });
  await event.run();
};
