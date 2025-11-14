import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';
import { useThrottledCallback } from 'use-debounce';

import type { IDialogInstance } from '@onekeyhq/components';
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

  const { result: cloudBackupFeatureInfo } = usePromiseResult(async () => {
    if (!supportCloudBackup) {
      return null;
    }
    const info =
      await backgroundApiProxy.serviceCloudBackupV2.getBackupProviderInfo();
    return {
      supportCloudBackup,
      icon: 'CloudOutline',
      title: info.displayNameI18nKey
        ? intl.formatMessage({
            id: info.displayNameI18nKey as any,
          })
        : info.displayName,
    };
  }, [intl, supportCloudBackup]);

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
            title: intl.formatMessage({
              id: ETranslations.google_play_services_not_available_title,
            }),
            description: intl.formatMessage({
              id: ETranslations.google_play_services_not_available_desc,
            }),
            onConfirmText: intl.formatMessage({
              id: ETranslations.global_got_it,
            }),
            onConfirm: () => undefined,
          });
          return false;
        }
        if (!cloudAccountInfo.googleDrive?.userInfo?.user?.id) {
          Dialog.confirm({
            icon: 'PeopleOutline',
            title: intl.formatMessage({
              id: ETranslations.google_account_not_signed_in,
            }),
            onConfirmText: intl.formatMessage({
              id: ETranslations.global_sign_in,
            }),
            onConfirm: async () => {
              await backgroundApiProxy.serviceCloudBackupV2.loginCloudIfNeed();
              Toast.success({
                title: intl.formatMessage({
                  id: ETranslations.signed_in_feedback,
                }),
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

  const doBackup = useThrottledCallback(
    async ({ data }: { data: IPrimeTransferData }) => {
      const isAvailable = await checkIsAvailable();
      if (!isAvailable) {
        return;
      }
      let verifyPasswordDialog: IDialogInstance | null = null;
      let resetPasswordDialog: IDialogInstance | null = null;
      let loadingDialog: IDialogInstance | null = null;

      const backupFn = async (password: string) => {
        await verifyPasswordDialog?.close?.();
        await resetPasswordDialog?.close?.();
        await loadingDialog?.close?.();
        setCheckLoading(true);
        await timerUtils.wait(350);
        try {
          loadingDialog = Dialog.loading({
            title: intl.formatMessage({ id: ETranslations.backing_up_title }),
            description: intl.formatMessage({
              id: ETranslations.backing_up_desc,
            }),
          });
          const result = await backgroundApiProxy.serviceCloudBackupV2.backup({
            password,
            data,
          });
          // Dialog.debugMessage({
          //   debugMessage: (_result as unknown as { meta: string })?.meta,
          // });
          if (result?.recordID) {
            Toast.success({
              title: intl.formatMessage({
                id: ETranslations.backup_success_toast_title,
              }),
            });
            navigation.pop();
            navigation.navigate(ERootRoutes.Main, undefined, {
              pop: true,
            });
          }
        } finally {
          void loadingDialog?.close?.();
          setCheckLoading(false);
        }
      };
      try {
        setCheckLoading(true);
        const isPasswordSet =
          await backgroundApiProxy.serviceCloudBackupV2.isBackupPasswordSet();
        const resetPasswordAndBackup = async () => {
          await verifyPasswordDialog?.close?.();
          resetPasswordDialog = showCloudBackupPasswordDialog({
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
              } else {
                Toast.error({
                  title: 'Failed to set backup password',
                });
              }
            },
          });
        };
        if (!isPasswordSet) {
          await resetPasswordAndBackup();
        } else {
          verifyPasswordDialog = showCloudBackupPasswordDialog({
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
                await backupFn(password);
              } else {
                Toast.error({
                  title: 'Failed to verify backup password',
                });
              }
            },
            onPressForgotPassword: async () => {
              void resetPasswordAndBackup();
            },
          });
        }
      } finally {
        setCheckLoading(false);
      }
    },
    350,
    {
      leading: true,
      trailing: false,
    },
  );

  const doDeleteBackup = useThrottledCallback(
    ({ recordID }: { recordID: string }) => {
      showCloudBackupDeleteDialog({ recordID, navigation });
    },
    350,
    {
      leading: true,
      trailing: false,
    },
  );

  const doRestoreBackup = useThrottledCallback(
    async ({
      payload,
    }: {
      // recordID: string;
      payload: IBackupDataEncryptedPayload | undefined;
    }) => {
      const isAvailable = await checkIsAvailable();
      if (!isAvailable) {
        return;
      }
      let importProcessingDialog: IDialogInstance | null = null;
      const verifyPasswordDialog = showCloudBackupPasswordDialog({
        isRestoreAction: true,
        onSubmit: async (password: string) => {
          // Show progress dialog
          try {
            setCheckLoading(true);
            await backgroundApiProxy.serviceCloudBackupV2.restorePreparePrivateData(
              {
                password,
                payload,
              },
            );
            await verifyPasswordDialog?.close?.();
            importProcessingDialog = showPrimeTransferImportProcessingDialog({
              navigation,
            });
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
                title: intl.formatMessage({
                  id: ETranslations.backup_restored,
                }),
              });
              navigation.pop();
              navigation.navigate(ERootRoutes.Main, undefined, {
                pop: true,
              });
            }
            // eslint-disable-next-line no-useless-catch
          } catch (error) {
            // password error
            void importProcessingDialog?.close?.();
            throw error;
          } finally {
            setCheckLoading(false);
            // void dialog.close();
          }
        },
      });
    },
    350,
    {
      leading: true,
      trailing: false,
    },
  );

  const startBackup = useCallback(async () => {
    const isAvailable = await checkIsAvailable();
    let loadingDialog: IDialogInstance | null = null;
    if (isAvailable) {
      if (platformEnv.isNativeAndroid) {
        await goToPageBackupDetail({
          actionType: 'backup',
          backupTime: Date.now(),
        });
      } else {
        loadingDialog = Dialog.loading({
          title: intl.formatMessage({
            id: ETranslations.preparing_backup_title,
          }),
          description: intl.formatMessage({
            id: ETranslations.preparing_backup_desc,
          }),
        });
        try {
          const data =
            await backgroundApiProxy.serviceCloudBackupV2.buildBackupData();
          await doBackup({ data });
        } finally {
          void loadingDialog?.close?.();
        }
      }
    }
  }, [checkIsAvailable, doBackup, goToPageBackupDetail, intl]);

  return useMemo(
    () => ({
      supportCloudBackup,
      cloudBackupFeatureInfo,
      startBackup,
      goToPageBackupList,
      checkLoading,
      doBackup,
      doDeleteBackup,
      doRestoreBackup,
    }),
    [
      supportCloudBackup,
      cloudBackupFeatureInfo,
      startBackup,
      goToPageBackupList,
      checkLoading,
      doBackup,
      doDeleteBackup,
      doRestoreBackup,
    ],
  );
}
