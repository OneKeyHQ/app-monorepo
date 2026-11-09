import { Dialog, Toast } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

import type { IntlShape } from 'react-intl';

export type ICloudBackupAvailabilityOptions = {
  isActive?: () => boolean;
  signInIfNeeded?: boolean;
};

export async function checkCloudBackupAvailability({
  intl,
  supportCloudBackup,
  setCheckLoading,
  isActive = () => true,
  signInIfNeeded = false,
}: ICloudBackupAvailabilityOptions & {
  intl: IntlShape;
  supportCloudBackup: boolean;
  setCheckLoading: (loading: boolean) => void;
}): Promise<boolean> {
  if (!isActive()) return false;
  try {
    setCheckLoading(true);
    if (!supportCloudBackup) {
      Toast.error({
        title: 'Cloud backup not support on your device',
      });
      return false;
    }
    const _showAlertDialogUnused = () => {
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
    if (!isActive()) return false;
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
      if (signInIfNeeded) {
        await backgroundApiProxy.serviceCloudBackupV2.loginCloudIfNeed();
        return isActive();
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
            if (!isActive()) return;
            await backgroundApiProxy.serviceCloudBackupV2.loginCloudIfNeed();
            if (!isActive()) return;
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
    if (isActive()) setCheckLoading(false);
  }
}
