import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import { Dialog, Toast } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IOnboardingParamListV2 } from '@onekeyhq/shared/src/routes';
import {
  EOnboardingPagesV2,
  EOnboardingV2Routes,
  ERootRoutes,
} from '@onekeyhq/shared/src/routes';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { showCloudBackupPasswordDialog } from '../components/CloudBackupPasswordDialog';

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
        if (!cloudAccountInfo.googleDrive?.email) {
          Dialog.confirm({
            icon: 'InfoCircleOutline',
            title: 'Google account is not available',
            description: 'Please sign in to your Google account',
            onConfirmText: intl.formatMessage({
              id: ETranslations.global_sign_in_register,
            }),
            onConfirm: () => {
              void backgroundApiProxy.serviceCloudBackupV2.loginCloudIfNeed();
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

  const doBackup = useCallback(async () => {
    showCloudBackupPasswordDialog({
      title: 'Enter your backup password',
      onSubmit: async (input: string) => {
        await backgroundApiProxy.serviceCloudBackupV2.backup({
          password: input,
        });
      },
    });
  }, []);

  const startBackup = useCallback(async () => {
    const isAvailable = await checkIsAvailable();
    if (isAvailable) {
      await goToPageBackupDetail({
        actionType: 'backup',
        backupTime: Date.now(),
      });
    }
  }, [checkIsAvailable, goToPageBackupDetail]);

  return useMemo(
    () => ({
      supportCloudBackup,
      startBackup,
      goToPageBackupList,
      checkLoading,
      doBackup,
    }),
    [
      supportCloudBackup,
      startBackup,
      goToPageBackupList,
      checkLoading,
      doBackup,
    ],
  );
}
