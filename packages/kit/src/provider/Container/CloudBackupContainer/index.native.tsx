import { useEffect } from 'react';

import { useIntl } from 'react-intl';

import { Dialog } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { openSettings } from '@onekeyhq/shared/src/utils/openUrlUtils';

export function CloudBackupContainer() {
  const intl = useIntl();
  useEffect(() => {
    void backgroundApiProxy.serviceCloudBackup
      .checkCloudBackupStatus()
      .then((isValid) => {
        if (isValid) {
          return;
        }
        Dialog.show({
          icon: 'InfoCircleOutline',
          title: intl.formatMessage({
            id: platformEnv.isNativeAndroid
              ? ETranslations.backup_google_drive_auto_backup_paused
              : ETranslations.backup_icloud_auto_backup_paused,
          }),
          description: intl.formatMessage({
            id: platformEnv.isNativeAndroid
              ? ETranslations.backup_verify_google_account_and_google_drive_enabled
              : ETranslations.backup_verify_apple_account_and_icloud_drive_enabled,
          }),
          onConfirmText: intl.formatMessage({
            id: ETranslations.global_go_settings,
          }),
          onCancelText: intl.formatMessage({ id: ETranslations.global_close }),
          onConfirm: () => openSettings('default'),
        });
      });
  }, [intl]);
}
