import { Dialog } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

// for open dev mode
let clickCount = 0;
let startTime: Date | undefined;

let isPasswordVerifying = false;

const showPromoteDialog = async () =>
  new Promise((resolve, reject) => {
    Dialog.show({
      title: 'Danger Zone',
      tone: 'warning',
      icon: 'ErrorOutline',
      description:
        'Are you sure you want to enable developer-related features?',
      dismissOnOverlayPress: false,
      confirmButtonProps: {
        testID: 'confirm-button',
      },
      onConfirm: resolve,
      onCancel: (close) => {
        void close();
        reject(new Error('User canceled'));
      },
    });
  });

export const handleOpenDevMode = async (callback: () => void) => {
  const nowTime = new Date();
  if (clickCount === 0) {
    callback();
  }
  if (isPasswordVerifying) {
    return;
  }
  if (
    startTime === undefined ||
    Math.round(nowTime.getTime() - startTime.getTime()) > 5000
  ) {
    startTime = nowTime;
    clickCount = 0;
  } else {
    clickCount += 1;
  }
  if (clickCount >= 9) {
    isPasswordVerifying = true;
    try {
      await showPromoteDialog();
      await backgroundApiProxy.servicePassword.promptPasswordVerify({
        dialogProps: {
          confirmButtonProps: {
            testID: 'confirm-button',
          },
          description:
            'Danger Zone: Are you sure you want to enable developer-related features?',
          dismissOnOverlayPress: false,
        },
      });
      await backgroundApiProxy.serviceDevSetting.switchDevMode(true);
    } catch (error) {
      /* empty */
    } finally {
      clickCount = 0;
      isPasswordVerifying = false;
    }
  }
};
