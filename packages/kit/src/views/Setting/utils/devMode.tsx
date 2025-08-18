import { Dialog, Input } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { isCorrectDevOnlyPassword } from '@onekeyhq/shared/src/background/backgroundDecorators';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { showDevOnlyPasswordDialog } from '../pages/Tab/DevSettingsSection';

// for open dev mode
let clickCount = 0;
let startTime: Date | undefined;
let isPasswordVerifying = false;

const resetClickCount = () => {
  clickCount = 0;
  startTime = undefined;
  isPasswordVerifying = false;
};

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

export const showDevModePasswordDialog = async () => {
  return new Promise((resolve, reject) => {
    Dialog.show({
      title: 'Developer Mode (Risk Warning)',
      tone: 'warning',
      icon: 'ErrorOutline',
      description:
        'Developer mode is for development only and may cause data loss. Do NOT enable if unsure.',
      dismissOnOverlayPress: false,
      confirmButtonProps: {
        testID: 'confirm-button',
      },
      renderContent: (
        <Dialog.Form formProps={{ values: { password: '' } }}>
          <Dialog.FormField
            name="password"
            rules={{
              required: { value: true, message: 'password is required.' },
            }}
          >
            <Input placeholder="Please enter the dev mode password." />
          </Dialog.FormField>
        </Dialog.Form>
      ),
      onConfirm: async ({ getForm }) => {
        const form = getForm();
        if (form) {
          const password = form.getValues('password');
          if (isCorrectDevOnlyPassword(password)) {
            resolve(true);
          } else {
            reject(new OneKeyLocalError('Invalid dev password'));
          }
        }
      },
      onCancel: () => {
        reject(new OneKeyLocalError('User canceled'));
      },
    });
  });
};

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
      await showDevModePasswordDialog();
    } catch (error) {
      console.error(error);
      resetClickCount();
      return;
    }
    try {
      await showPromoteDialog();
      try {
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
        showDevOnlyPasswordDialog({
          title: 'Danger Zone',
          description: 'Fallback to devOnlyPassword verification',
          onConfirm: async () => {
            await backgroundApiProxy.serviceDevSetting.switchDevMode(true);
          },
        });
      }
    } catch (error) {
      /* empty */
    } finally {
      resetClickCount();
    }
  }
};
