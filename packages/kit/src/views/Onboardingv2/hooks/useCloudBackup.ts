import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import { Dialog, Toast } from '@onekeyhq/components';
import type { IBackupDataEncryptedPayload } from '@onekeyhq/kit-bg/src/services/ServiceCloudBackupV2/backupProviders/IOneKeyBackupProvider';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IOnboardingParamListV2 } from '@onekeyhq/shared/src/routes';
import {
  EOnboardingPagesV2,
  EOnboardingV2Routes,
  ERootRoutes,
} from '@onekeyhq/shared/src/routes';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IPrimeTransferData } from '@onekeyhq/shared/types/prime/primeTransferTypes';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { showPrimeTransferImportProcessingDialog } from '../../Prime/pages/PagePrimeTransfer/components/PrimeTransferImportProcessingDialog';
import {
  showCloudBackupDeleteDialog,
  showCloudBackupPasswordDialog,
} from '../components/CloudBackupDialogs';

export function useCloudBackup() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const [checkLoading, setCheckLoading] = useState(false);

  const { result: supportCloudBackup = false } = usePromiseResult(async () => {
    return backgroundApiProxy.serviceCloudBackupV2.supportCloudBackup();
  }, []);

  const checkIsAvailable = useCallback(async (): Promise<boolean> => {
    try {
      setCheckLoading(true);
      if (!supportCloudBackup) {
        Toast.error({
          title: 'Cloud backup not support on your device',
        });
        return false;
      }
      const showAlertDialog = () => {
        Dialog.confirm({
          icon: 'InfoCircleOutline',
          title: intl.formatMessage({
            id: platformEnv.isNativeAndroid
              ? // You have no available Google Drive backups to import.
                ETranslations.settings_google_drive_backup
              : ETranslations.settings_icloud_backup,
          }),
          description: intl.formatMessage({
            id: platformEnv.isNativeAndroid
              ? // To enable this feature, please download Google Drive, log in, and ensure that OneKey has the necessary permissions.
                ETranslations.backup_enable_feature_download_google_drive
              : ETranslations.backup_please_log_in_to_your_apple_account_and_activate_icloud_drive,
          }),
          onConfirmText: intl.formatMessage({
            id: platformEnv.isNativeAndroid
              ? ETranslations.global_got_it
              : ETranslations.backup_go_system_settings,
          }),
          onConfirm: () =>
            platformEnv.isNativeIOS
              ? openUrlExternal('App-prefs:CASTLE')
              : undefined,
        });
      };
      const cloudAccountInfo =
        await backgroundApiProxy.serviceCloudBackupV2.getCloudAccountInfo();
      if (platformEnv.isNativeIOS || platformEnv.isDesktopMac) {
        if (
          !cloudAccountInfo.iCloud?.cloudKitAvailable ||
          !cloudAccountInfo.iCloud?.cloudKitContainerUserId
        ) {
          Dialog.confirm({
            icon: 'InfoCircleOutline',
            title: intl.formatMessage({
              id: ETranslations.settings_icloud_backup,
            }),
            description: intl.formatMessage({
              id: ETranslations.backup_please_log_in_to_your_apple_account_and_activate_icloud_drive,
            }),
            onConfirmText: intl.formatMessage({
              id: platformEnv.isDesktopMac
                ? ETranslations.global_got_it
                : ETranslations.backup_go_system_settings,
            }),
            onConfirm: () =>
              platformEnv.isDesktopMac
                ? undefined
                : openUrlExternal('App-prefs:CASTLE'),
          });
          return false;
        }
        // console
        return true;
      }
      if (platformEnv.isNativeAndroid) {
        if (!cloudAccountInfo.googleDrive?.googlePlayServiceAvailable) {
          Dialog.confirm({
            icon: 'InfoCircleOutline',
            title: 'Google Play Services is not available',
            description:
              'Please install Google Play Services and sign in to your Google account',
            onConfirmText: intl.formatMessage({
              id: ETranslations.global_got_it,
            }),
            onConfirm: () => undefined,
          });
          return false;
        }
        if (!cloudAccountInfo.googleDrive?.userInfo?.user?.id) {
          Dialog.confirm({
            icon: 'InfoCircleOutline',
            // TODO: franco 未登录时，引导用户登录 Google 账户
            title: 'Google account is not available',
            description: 'Please sign in to your Google account',
            onConfirmText: 'Sign in',
            onConfirm: async () => {
              await backgroundApiProxy.serviceCloudBackupV2.loginCloudIfNeed();
              // error: Sign in action cancelled
              Toast.success({
                title: 'Signed in successfully',
              });
            },
          });
          return false;
        }
        return true;
      }
      return false;
    } finally {
      setCheckLoading(false);
    }
  }, [intl, supportCloudBackup]);

  const goToPageBackupList = useCallback(async () => {
    const isAvailable = await checkIsAvailable();
    if (isAvailable) {
      navigation.navigate(ERootRoutes.Onboarding, {
        screen: EOnboardingV2Routes.OnboardingV2,
        params: {
          screen: EOnboardingPagesV2.ICloudBackup,
        },
      });
    }
  }, [checkIsAvailable, navigation]);

  const goToPageBackupDetail = useCallback(
    async (
      params: IOnboardingParamListV2[EOnboardingPagesV2.ICloudBackupDetails],
    ) => {
      const isAvailable = await checkIsAvailable();
      if (isAvailable) {
        navigation.navigate(ERootRoutes.Onboarding, {
          screen: EOnboardingV2Routes.OnboardingV2,
          params: {
            screen: EOnboardingPagesV2.ICloudBackupDetails,
            params,
          },
        });
      }
    },
    [checkIsAvailable, navigation],
  );

  const startBackup = useCallback(async () => {
    const isAvailable = await checkIsAvailable();
    if (isAvailable) {
      await goToPageBackupDetail({
        actionType: 'backup',
        backupTime: Date.now(),
      });
    }
  }, [checkIsAvailable, goToPageBackupDetail]);

  const doBackup = useCallback(
    async ({ data }: { data: IPrimeTransferData }) => {
      const isAvailable = await checkIsAvailable();
      if (!isAvailable) {
        return;
      }
      const backupFn = async (password: string) => {
        const result = await backgroundApiProxy.serviceCloudBackupV2.backup({
          password,
          data,
        });
        // Dialog.debugMessage({
        //   debugMessage: (_result as unknown as { meta: string })?.meta,
        // });
        if (result?.recordID) {
          Toast.success({
            // TODO: franco
            title: 'Backup done!',
          });
          navigation.pop();
        }
      };
      try {
        setCheckLoading(true);
        const isPasswordSet =
          await backgroundApiProxy.serviceCloudBackupV2.isBackupPasswordSet();
        const resetPasswordAndBackup = async () => {
          showCloudBackupPasswordDialog({
            showConfirmPasswordField: true,
            onSubmit: async (password: string) => {
              const result =
                await backgroundApiProxy.serviceCloudBackupV2.setBackupPassword(
                  {
                    password,
                  },
                );
              if (result?.recordID) {
                await backupFn(password);
              }
            },
          });
        };
        if (!isPasswordSet) {
          await resetPasswordAndBackup();
        } else {
          const verifyPasswordDialog = showCloudBackupPasswordDialog({
            showConfirmPasswordField: false,
            showForgotPasswordButton: true,
            onSubmit: async (password: string) => {
              const result =
                await backgroundApiProxy.serviceCloudBackupV2.verifyBackupPassword(
                  {
                    password,
                  },
                );
              if (result === true) {
                await verifyPasswordDialog.close();
                await timerUtils.wait(350);
                await backupFn(password);
              }
            },
            onPressForgotPassword: () => {
              Dialog.confirm({
                title: 'Forgot password',
                description:
                  'If you forget your password, you can reset a new password. The new password is only valid for subsequent backups. The previous backups still need the original password to decrypt.',
                onConfirmText: 'Reset password',
                onConfirm: async () => {
                  await verifyPasswordDialog.close();
                  void resetPasswordAndBackup();
                },
              });
            },
          });
        }
      } finally {
        setCheckLoading(false);
      }
    },
    [checkIsAvailable, navigation],
  );

  const doDeleteBackup = useCallback(
    ({ recordID }: { recordID: string }) => {
      showCloudBackupDeleteDialog({ recordID, navigation });
    },
    [navigation],
  );

  const doRestoreBackup = useCallback(
    ({
      payload,
    }: {
      // recordID: string;
      payload: IBackupDataEncryptedPayload | undefined;
    }) => {
      showCloudBackupPasswordDialog({
        onSubmit: async (password: string) => {
          const isAvailable = await checkIsAvailable();
          await timerUtils.wait(1000);
          if (isAvailable) {
            // Show progress dialog
            const dialog = showPrimeTransferImportProcessingDialog({
              navigation,
            });
            try {
              const result =
                await backgroundApiProxy.serviceCloudBackupV2.restore({
                  password,
                  payload,
                });
              // Dialog.debugMessage({
              //   debugMessage: result,
              // });
              if (result?.success) {
                Toast.success({
                  title: 'Backup restored!',
                });
                navigation.pop();
              }
              // eslint-disable-next-line no-useless-catch
            } catch (error) {
              // password error
              void dialog.close();
              throw error;
            } finally {
              // void dialog.close();
            }
          }
        },
      });
    },
    [checkIsAvailable, navigation],
  );

  return useMemo(
    () => ({
      supportCloudBackup,
      startBackup,
      goToPageBackupList,
      checkLoading,
      doBackup,
      doDeleteBackup,
      doRestoreBackup,
    }),
    [
      supportCloudBackup,
      startBackup,
      goToPageBackupList,
      checkLoading,
      doBackup,
      doDeleteBackup,
      doRestoreBackup,
    ],
  );
}
