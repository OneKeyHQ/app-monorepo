import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';
import { useThrottledCallback } from 'use-debounce';

import type { IDialogInstance } from '@onekeyhq/components';
import { Dialog, Toast, rootNavigationRef } from '@onekeyhq/components';
import type { ICloudBackupExitPreventAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  cloudBackupExitPreventAtom,
  useCloudBackupStatusAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IBackupDataEncryptedPayload } from '@onekeyhq/shared/src/cloudBackup/cloudBackupTypes';
import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import errorUtils from '@onekeyhq/shared/src/errors/utils/errorUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EOnboardingPagesV2,
  EOnboardingV2Routes,
  ERootRoutes,
} from '@onekeyhq/shared/src/routes';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IPrimeTransferData } from '@onekeyhq/shared/types/prime/primeTransferTypes';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { useIsMounted } from '../../../hooks/useIsMounted';
import { showPrimeTransferImportProcessingDialog } from '../../Prime/pages/PagePrimeTransfer/components/PrimeTransferImportProcessingDialog';
import {
  showCloudBackupDeleteDialog,
  showCloudBackupPasswordDialog,
} from '../components/CloudBackupDialogs';

import type { ICloudBackupAvailabilityOptions } from './checkCloudBackupAvailability';

let isBackupErrorDialogShowing = false;

export function useCloudBackup() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const [checkLoading, setCheckLoading] = useState(false);
  const isMountedRef = useIsMounted();

  const [cloudBackupStatus] = useCloudBackupStatusAtom();

  const supportCloudBackup = cloudBackupStatus.supportCloudBackup;

  const cloudBackupFeatureInfo = useMemo(() => {
    if (!supportCloudBackup) {
      return null;
    }
    const info = cloudBackupStatus.cloudBackupProviderInfo;
    if (!info) {
      return null;
    }
    return {
      supportCloudBackup,
      icon: 'CloudOutline',
      title: info.displayNameI18nKey
        ? intl.formatMessage({
            id: info.displayNameI18nKey as any,
          })
        : info.displayName,
    };
  }, [cloudBackupStatus.cloudBackupProviderInfo, intl, supportCloudBackup]);

  const checkIsAvailable = useCallback(
    async (options: ICloudBackupAvailabilityOptions = {}) => {
      // Wallet entry points mount this hook during startup; load authorization
      // UI only when a cloud operation requests it. The helper rechecks ownership.
      const { checkCloudBackupAvailability } =
        await import('./checkCloudBackupAvailability');
      return checkCloudBackupAvailability({
        intl,
        supportCloudBackup,
        setCheckLoading,
        ...options,
      });
    },
    [intl, supportCloudBackup],
  );

  const goToPageBackupList = useCallback(
    async ({ hideRestoreButton }: { hideRestoreButton?: boolean } = {}) => {
      const isAvailable = await checkIsAvailable();
      if (isAvailable) {
        if (platformEnv.isNativeAndroid) {
          await backgroundApiProxy.serviceCloudBackupV2.loginCloudIfNeed();
        }
        navigation.navigate(ERootRoutes.Onboarding, {
          screen: EOnboardingV2Routes.OnboardingV2,
          params: {
            screen: EOnboardingPagesV2.ICloudBackup,
            params: {
              hideRestoreButton,
            },
          },
        });
        defaultLogger.account.wallet.addWalletStarted({
          addMethod: 'ImportWallet',
          details: {
            importType: 'cloud',
          },
          isSoftwareWalletOnlyUser: true,
        });
      }
    },
    [checkIsAvailable, navigation],
  );

  // The destination page owns authorization after an explicit navigation handoff.
  const prepareBackup = useCallback(async () => {
    const isAvailable = await checkIsAvailable({
      isActive: () => isMountedRef.current,
      signInIfNeeded: true,
    });
    if (!isAvailable || !isMountedRef.current) return undefined;
    const data =
      await backgroundApiProxy.serviceCloudBackupV2.buildBackupData();
    return isMountedRef.current ? data : undefined;
  }, [checkIsAvailable, isMountedRef]);

  const doBackup = useThrottledCallback(
    async ({
      data,
      backupTimes,
    }: {
      data: IPrimeTransferData;
      backupTimes?: number;
    }) => {
      const isAvailable = await checkIsAvailable({
        isActive: () => isMountedRef.current,
      });
      if (!isAvailable || !isMountedRef.current) {
        return;
      }
      let verifyPasswordDialog: IDialogInstance | null = null;
      let resetPasswordDialog: IDialogInstance | null = null;
      let loadingDialog: IDialogInstance | null = null;

      function handleBackupError(error: unknown) {
        if (!isMountedRef.current) {
          throw error;
        }
        const e = error as Error | undefined;
        const errorMessage = e?.message;
        if (
          errorMessage &&
          errorMessage.includes('Quota exceeded') &&
          errorMessage.includes('CKRecordID')
        ) {
          errorToastUtils.toastIfErrorDisable(error);
        }
        if (
          errorUtils.isErrorByClassName({
            error,
            className: [EOneKeyErrorClassNames.IncorrectPassword],
          })
        ) {
          // skip
        } else {
          if (isBackupErrorDialogShowing) {
            throw error;
          }

          isBackupErrorDialogShowing = true;

          Dialog.show({
            title: intl.formatMessage({
              id: ETranslations.cloud_backup_failed,
            }),
            description: platformEnv.isNativeAndroid
              ? intl.formatMessage({
                  id: ETranslations.cloud_backup_failed_google_desc,
                })
              : intl.formatMessage({
                  id: ETranslations.cloud_backup_failed_apple_desc,
                }),
            onCancelText: intl.formatMessage({
              id: ETranslations.global_manage_backups,
            }),
            onCancel: () => {
              isBackupErrorDialogShowing = false;
              void goToPageBackupList({ hideRestoreButton: true });
            },
            onConfirmText: intl.formatMessage({
              id: ETranslations.global_close,
            }),
            onClose: () => {
              isBackupErrorDialogShowing = false;
            },
          });
        }
        throw error;
      }

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
          await cloudBackupExitPreventAtom.set(
            (v): ICloudBackupExitPreventAtom => ({
              ...v,
              shouldPreventExit: true,
            }),
          );
          const result = await backgroundApiProxy.serviceCloudBackupV2.backup({
            password,
            data,
          });
          if (backupTimes && backupTimes > 2) {
            for (let i = 0; i < backupTimes; i += 1) {
              Toast.success({
                title: `Backup ${i + 1} of ${backupTimes}`,
              });
              await backgroundApiProxy.serviceCloudBackupV2.backup({
                password,
                data,
              });
            }
          }
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
        } catch (error) {
          handleBackupError(error);
        } finally {
          void loadingDialog?.close?.();
          setCheckLoading(false);
          await cloudBackupExitPreventAtom.set(
            (v): ICloudBackupExitPreventAtom => ({
              ...v,
              shouldPreventExit: false,
            }),
          );
        }
      };
      try {
        setCheckLoading(true);
        const isPasswordSet =
          await backgroundApiProxy.serviceCloudBackupV2.isBackupPasswordSet();
        // Drive consent can outlive the page that started the backup.
        if (!isMountedRef.current) {
          return;
        }
        const resetPasswordAndBackup = async ({
          isFirstTimeSetPassword,
        }: { isFirstTimeSetPassword?: boolean } = {}) => {
          await verifyPasswordDialog?.close?.();
          resetPasswordDialog = showCloudBackupPasswordDialog({
            showConfirmPasswordField: true,
            isFirstTimeSetPassword,
            intl,
            onSubmit: async (password: string) => {
              try {
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
              } catch (error) {
                handleBackupError(error);
              }
            },
          });
        };
        if (!isPasswordSet) {
          await resetPasswordAndBackup({ isFirstTimeSetPassword: true });
        } else {
          verifyPasswordDialog = showCloudBackupPasswordDialog({
            showConfirmPasswordField: false,
            showForgotPasswordButton: true,
            intl,
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
        if (isMountedRef.current) {
          setCheckLoading(false);
        }
      }
    },
    600,
    {
      leading: true,
      trailing: false,
    },
  );

  const doDeleteBackup = useThrottledCallback(
    ({ recordID }: { recordID: string }) => {
      showCloudBackupDeleteDialog({ recordID, navigation, intl });
    },
    600,
    {
      leading: true,
      trailing: false,
    },
  );

  const doRestoreBackup = useThrottledCallback(
    async ({
      payload,
      recordId,
    }: {
      recordId?: string;
      payload: IBackupDataEncryptedPayload | undefined;
    }) => {
      const isAvailable = await checkIsAvailable();
      if (!isAvailable) {
        return;
      }
      let importProcessingDialog: IDialogInstance | null = null;
      const restoreBackup = async (
        password?: string,
        verifyPasswordDialog?: IDialogInstance,
      ): Promise<boolean> => {
        let importTaskUUID: string | undefined;
        // Show progress dialog
        try {
          await cloudBackupExitPreventAtom.set(
            (v): ICloudBackupExitPreventAtom => ({
              ...v,
              shouldPreventExit: true,
            }),
          );
          setCheckLoading(true);
          let restoreId: string | undefined;
          if (
            (platformEnv.isNativeIOS || platformEnv.isNativeAndroid) &&
            recordId
          ) {
            const prepared =
              await backgroundApiProxy.serviceCloudBackupV2.prepareLocalRestore(
                { recordId, password },
              );
            if (!prepared) return false;
            restoreId = prepared.restoreId;
          } else if (password !== undefined) {
            await backgroundApiProxy.serviceCloudBackupV2.restorePreparePrivateData(
              { password, payload, recordId },
            );
          } else {
            return false;
          }
          importTaskUUID = await errorToastUtils.withErrorAutoToast(() =>
            backgroundApiProxy.servicePrimeTransfer.prepareImportTask(),
          );
          if (!importTaskUUID) return true;
          await verifyPasswordDialog?.close?.();
          // Delay to ensure the dialog is closed before proceeding
          if (platformEnv.isNative && verifyPasswordDialog) {
            await timerUtils.wait(350);
          }
          importProcessingDialog = showPrimeTransferImportProcessingDialog({
            taskUUID: importTaskUUID,
            intl,
            navigation,
          });
          const result = restoreId
            ? await backgroundApiProxy.serviceCloudBackupV2.restorePreparedLocalBackup(
                { restoreId, taskUUID: importTaskUUID },
              )
            : await backgroundApiProxy.serviceCloudBackupV2.restore({
                taskUUID: importTaskUUID,
                password: password ?? '',
                payload,
                recordId,
              });
          if (!result) {
            await backgroundApiProxy.servicePrimeTransfer.resetImportProgress({
              taskUUID: importTaskUUID,
            });
            await importProcessingDialog.close();
            importProcessingDialog = null;
            return false;
          }
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
          return true;
          // eslint-disable-next-line no-useless-catch
        } catch (error) {
          // Release this task before closing, without cancelling a newer import.
          if (importTaskUUID) {
            await backgroundApiProxy.servicePrimeTransfer.resetImportProgress({
              taskUUID: importTaskUUID,
            });
            await importProcessingDialog?.close();
          }
          throw error;
        } finally {
          setCheckLoading(false);
          // void dialog.close();
          await cloudBackupExitPreventAtom.set(
            (v): ICloudBackupExitPreventAtom => ({
              ...v,
              shouldPreventExit: false,
            }),
          );
        }
      };
      const showPasswordDialog = () => {
        const dialog = showCloudBackupPasswordDialog({
          isRestoreAction: true,
          intl,
          onSubmit: async (password: string) => {
            if (!(await restoreBackup(password, dialog))) {
              await dialog.close();
              showPasswordDialog();
            }
          },
        });
      };
      if (
        (platformEnv.isNativeIOS || platformEnv.isNativeAndroid) &&
        recordId &&
        (await restoreBackup())
      )
        return;
      showPasswordDialog();
    },
    600,
    {
      leading: true,
      trailing: false,
    },
  );

  const openBackupDetail = useCallback(() => {
    rootNavigationRef.current?.navigate(ERootRoutes.Onboarding, {
      screen: EOnboardingV2Routes.OnboardingV2,
      params: {
        screen: EOnboardingPagesV2.ICloudBackupDetails,
        params: { actionType: 'backup', backupTime: Date.now() },
      },
    });
  }, []);

  const startBackupInPage = useThrottledCallback(
    async () => {
      if (!isMountedRef.current) return;
      if (platformEnv.isNativeAndroid) {
        openBackupDetail();
        return;
      }
      const isAvailable = await checkIsAvailable({
        isActive: () => isMountedRef.current,
      });
      if (!isAvailable || !isMountedRef.current) return;
      const loadingDialog = Dialog.loading({
        title: intl.formatMessage({ id: ETranslations.preparing_backup_title }),
        description: intl.formatMessage({
          id: ETranslations.preparing_backup_desc,
        }),
      });
      try {
        await timerUtils.wait(300);
        if (!isMountedRef.current) return;
        const data =
          await backgroundApiProxy.serviceCloudBackupV2.buildBackupData();
        if (!isMountedRef.current) return;
        await doBackup({ data });
      } finally {
        void loadingDialog?.close?.();
      }
    },
    600,
    { leading: true, trailing: false },
  );

  const startBackup = useCallback(
    async ({
      alwaysGoToBackupDetail,
    }: { alwaysGoToBackupDetail?: boolean } = {}) => {
      // Settings and wallet actions intentionally dismiss their source page first.
      // A throttled callback cannot run after unmount; hand off navigation directly.
      if (alwaysGoToBackupDetail) {
        openBackupDetail();
        return;
      }
      await startBackupInPage();
    },
    [openBackupDetail, startBackupInPage],
  );

  return useMemo(
    () => ({
      supportCloudBackup,
      cloudBackupFeatureInfo,
      startBackup,
      prepareBackup,
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
      prepareBackup,
      goToPageBackupList,
      checkLoading,
      doBackup,
      doDeleteBackup,
      doRestoreBackup,
    ],
  );
}
