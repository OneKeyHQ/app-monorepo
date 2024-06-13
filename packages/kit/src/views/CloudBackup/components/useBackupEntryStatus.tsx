import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Dialog, Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { openSettings } from '@onekeyhq/shared/src/utils/openUrlUtils';

export function useBackupEntryStatus() {
  const intl = useIntl();
  const check = useCallback(async () => {
    if (!(await backgroundApiProxy.serviceCloudBackup.getCloudAvailable())) {
      Dialog.confirm({
        icon: 'InfoCircleOutline',
        title: intl.formatMessage({
          id: platformEnv.isNativeAndroid
            ? ETranslations.settings_google_drive_backup
            : ETranslations.settings_icloud_backup,
        }),
        description: intl.formatMessage({
          id: platformEnv.isNativeAndroid
            ? ETranslations.backup_enable_feature_download_google_drive
            : ETranslations.backup_please_log_in_to_your_apple_account_and_activate_icloud_drive,
        }),
        onConfirmText: intl.formatMessage({
          id: platformEnv.isNativeAndroid
            ? ETranslations.global_got_it
            : ETranslations.backup_go_system_settings,
        }),
        onConfirm: () =>
          platformEnv.isNativeIOS ? openSettings('default') : undefined,
      });
      throw new Error('cloud service is not available');
    }
    try {
      await backgroundApiProxy.serviceCloudBackup.loginIfNeeded(true);
    } catch (e) {
      Toast.error({
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        title: `google auth failed ${e}`,
      });
      throw e;
    }
  }, [intl]);
  return useMemo(
    () => ({
      check,
    }),
    [check],
  );
}
