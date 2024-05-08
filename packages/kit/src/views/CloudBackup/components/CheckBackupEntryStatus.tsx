import { Dialog, Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { backupPlatform } from '@onekeyhq/shared/src/cloudfs';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { openSettings } from '@onekeyhq/shared/src/utils/openUrlUtils';

export async function checkBackupEntryStatus() {
  if (!(await backgroundApiProxy.serviceCloudBackup.getCloudAvailable())) {
    Dialog.confirm({
      icon: 'InfoCircleOutline',
      title: `${backupPlatform().cloudName} Backup`,
      description: platformEnv.isNativeIOS
        ? `Please log in to your Apple account and activate the iCloud Drive feature before proceeding.`
        : `To enable this feature, please download Google Drive, log in, and ensure that OneKey has the necessary permissions.`,
      onConfirmText: platformEnv.isNativeIOS ? 'Go System Settings' : 'Got it',
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
}
