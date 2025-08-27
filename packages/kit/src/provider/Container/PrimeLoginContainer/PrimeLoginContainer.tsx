import { useEffect, useRef } from 'react';

import { throttle } from 'lodash';
import { useIntl } from 'react-intl';

import type { IDialogInstance } from '@onekeyhq/components';
import { Dialog, Stack } from '@onekeyhq/components';
import type { IPrimeLoginDialogAtomPasswordData } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  usePasswordAtom,
  usePrimeCloudSyncPersistAtom,
  usePrimeLoginDialogAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EPrimePages } from '@onekeyhq/shared/src/routes/prime';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { PrimeDeviceLogoutAlertDialog } from '../../../views/Prime/components/PrimeDeviceLogoutAlertDialog';
import { PrimeForgetMasterPasswordDialog } from '../../../views/Prime/components/PrimeForgetMasterPasswordDialog';
import { PrimeLoginPasswordDialog } from '../../../views/Prime/components/PrimeLoginPasswordDialog';
import { PrimeMasterPasswordInvalidDialog } from '../../../views/Prime/components/PrimeMasterPasswordInvalidDialog';
import { PrimeSetMasterPasswordHintDialog } from '../../../views/Prime/components/PrimeSetMasterPasswordHintDialog';

const showTimeErrorDialog = throttle(
  (intl: ReturnType<typeof useIntl>) => {
    Dialog.confirm({
      title: intl.formatMessage({
        id: ETranslations.prime_time_error_title,
      }),
      description: intl.formatMessage({
        id: ETranslations.prime_time_error_description,
      }),
      onConfirmText: intl.formatMessage({
        id: ETranslations.global_got_it,
      }),
      dismissOnOverlayPress: false,
    });
  },
  timerUtils.getTimeDurationMs({
    minute: 5,
  }),
  {
    leading: true,
    trailing: false,
  },
);

// TODO rename to PrimeDialogContainer
export function PrimeLoginContainer() {
  const [passwordAtom] = usePasswordAtom();
  const [cloudSyncPersistAtom] = usePrimeCloudSyncPersistAtom();
  const [
    {
      promptPrimeLoginEmailDialog,
      promptPrimeLoginPasswordDialog,
      promptPrimeLoginEmailCodeDialog,
      promptForgetMasterPasswordDialog,
    },
  ] = usePrimeLoginDialogAtom();
  const navigation = useAppNavigation();
  const intl = useIntl();
  const passwordDataRef = useRef<IPrimeLoginDialogAtomPasswordData | undefined>(
    undefined,
  );
  passwordDataRef.current = promptPrimeLoginPasswordDialog;

  const emailDialogRef = useRef<IDialogInstance | undefined>(undefined);
  useEffect(() => {
    void (async () => {
      if (promptPrimeLoginEmailDialog) {
        await emailDialogRef.current?.close();
        emailDialogRef.current = Dialog.show({
          renderContent: (
            <Stack />
            // <PrimeLoginEmailDialog promiseId={promptPrimeLoginEmailDialog} />
          ),
          onClose: async () => {
            await backgroundApiProxy.servicePrime.cancelPrimeLogin({
              promiseId: promptPrimeLoginEmailDialog,
              dialogType: 'promptPrimeLoginEmailDialog',
            });
          },
        });
      } else {
        await emailDialogRef.current?.close();
      }
    })();
  }, [promptPrimeLoginEmailDialog]);

  const passwordDialogRef = useRef<IDialogInstance | undefined>(undefined);
  const passwordHintDialogRef = useRef<IDialogInstance | undefined>(undefined);
  useEffect(() => {
    void (async () => {
      if (promptPrimeLoginPasswordDialog?.promiseId) {
        await passwordDialogRef.current?.close();
        await passwordHintDialogRef.current?.close();
        const data = passwordDataRef.current;

        const showPasswordDialog = () => {
          let title = 'Welcome back';
          let description = `Manage your OneKey ID <email>${
            data?.email || ''
          }</email>`;
          if (data?.isRegister) {
            title = intl.formatMessage({
              id: ETranslations.prime_set_up_backup_password,
            });
            description = '';

            if (data?.isChangeMasterPassword) {
              title = intl.formatMessage({
                id: ETranslations.prime_change_backup_password,
              });
              description = '';
            }
            // description = 'Please enter a password to secure your sync data';
            // description = `<email>${email}</email> is not registered yet, we will create a new account for you.`;
          }

          if (data?.isVerifyMasterPassword && !data?.isRegister) {
            title = intl.formatMessage({
              id: ETranslations.prime_verify_backup_password,
            });
            description = '';
          }

          passwordDialogRef.current = Dialog.show({
            disableDrag: true,
            dismissOnOverlayPress: !data?.isRegister,
            title,
            // description,
            renderContent: (
              <PrimeLoginPasswordDialog
                data={data}
                promiseId={promptPrimeLoginPasswordDialog?.promiseId}
                richTextDescription={description}
              />
            ),
            onClose: async () => {
              await backgroundApiProxy.servicePrime.cancelPrimeLogin({
                promiseId: promptPrimeLoginPasswordDialog?.promiseId,
                dialogType: 'promptPrimeLoginPasswordDialog',
              });
            },
          });
        };

        if (data?.isRegister && !data?.isChangeMasterPassword) {
          let shouldRejectOnClose = true;
          passwordHintDialogRef.current = Dialog.show({
            disableDrag: true,
            dismissOnOverlayPress: false,
            icon: 'ShieldKeyholeOutline',
            title: intl.formatMessage({
              id: ETranslations.prime_set_up_backup_password,
            }),
            renderContent: (
              <PrimeSetMasterPasswordHintDialog
                onContinue={() => {
                  shouldRejectOnClose = false;
                  showPasswordDialog();
                }}
              />
            ),
            onClose: async () => {
              if (!shouldRejectOnClose) {
                return;
              }
              await backgroundApiProxy.servicePrime.cancelPrimeLogin({
                promiseId: promptPrimeLoginPasswordDialog?.promiseId,
                dialogType: 'promptPrimeLoginPasswordDialog',
              });
            },
          });
        } else {
          showPasswordDialog();
        }
      } else {
        await passwordDialogRef.current?.close();
        await passwordHintDialogRef.current?.close();
      }
    })();
  }, [intl, promptPrimeLoginPasswordDialog?.promiseId]);

  const forgetMasterPasswordDialogRef = useRef<IDialogInstance | undefined>(
    undefined,
  );
  useEffect(() => {
    void (async () => {
      if (promptForgetMasterPasswordDialog?.promiseId) {
        await forgetMasterPasswordDialogRef.current?.close();

        forgetMasterPasswordDialogRef.current = Dialog.show({
          icon: 'ErrorOutline',
          tone: 'destructive',
          title: intl.formatMessage({
            id: ETranslations.prime_reset_backup_password_title,
          }),
          renderContent: (
            <PrimeForgetMasterPasswordDialog
              promiseId={promptForgetMasterPasswordDialog?.promiseId}
            />
          ),
          onClose: async () => {
            await backgroundApiProxy.servicePrime.cancelPrimeLogin({
              promiseId: promptForgetMasterPasswordDialog?.promiseId,
              dialogType: 'promptForgetMasterPasswordDialog',
            });
          },
        });
      } else {
        await forgetMasterPasswordDialogRef.current?.close();
      }
    })();
  }, [intl, promptForgetMasterPasswordDialog?.promiseId]);

  const emailCodeDialogRef = useRef<IDialogInstance | undefined>(undefined);
  useEffect(() => {
    void (async () => {
      if (promptPrimeLoginEmailCodeDialog?.promiseId) {
        await emailCodeDialogRef.current?.close();
        emailCodeDialogRef.current = Dialog.show({
          renderContent: (
            <Stack />
            // <PrimeLoginEmailCodeDialog
            //   promiseId={promptPrimeLoginEmailCodeDialog?.promiseId}
            // />
          ),
          onClose: async () => {
            await backgroundApiProxy.servicePrime.cancelPrimeLogin({
              promiseId: promptPrimeLoginEmailCodeDialog?.promiseId,
              dialogType: 'promptPrimeLoginEmailCodeDialog',
            });
          },
        });
      } else {
        await emailCodeDialogRef.current?.close();
      }
    })();
  }, [promptPrimeLoginEmailCodeDialog?.promiseId]);

  useEffect(() => {
    const fn = () => {
      navigation.pushFullModal(EModalRoutes.PrimeModal, {
        screen: EPrimePages.PrimeDeviceLimit,
        params: {
          isExceedDeviceLimit: true,
        },
      });
    };
    appEventBus.on(EAppEventBusNames.PrimeExceedDeviceLimit, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.PrimeExceedDeviceLimit, fn);
    };
  }, [navigation]);

  useEffect(() => {
    const fn = () => {
      Dialog.show({
        renderContent: <PrimeDeviceLogoutAlertDialog />,
      });
    };
    appEventBus.on(EAppEventBusNames.PrimeDeviceLogout, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.PrimeDeviceLogout, fn);
    };
  }, []);

  useEffect(() => {
    const fn = () => {
      Dialog.show({
        dismissOnOverlayPress: false,
        disableDrag: true,
        renderContent: <PrimeMasterPasswordInvalidDialog />,
      });
    };
    appEventBus.on(EAppEventBusNames.PrimeMasterPasswordInvalid, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.PrimeMasterPasswordInvalid, fn);
    };
  }, []);

  useEffect(() => {
    const fn = () => {
      if (cloudSyncPersistAtom?.isCloudSyncEnabled && passwordAtom.unLock) {
        showTimeErrorDialog(intl);
      }
    };
    appEventBus.on(EAppEventBusNames.LocalSystemTimeInvalid, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.LocalSystemTimeInvalid, fn);
    };
  }, [cloudSyncPersistAtom?.isCloudSyncEnabled, intl, passwordAtom.unLock]);

  return null;
}
