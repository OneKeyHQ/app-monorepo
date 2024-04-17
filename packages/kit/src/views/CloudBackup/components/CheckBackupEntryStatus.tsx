import { Dialog, Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { backupPlatform } from '@onekeyhq/shared/src/cloudfs';
import { openSettings } from '@onekeyhq/shared/src/utils/openUrlUtils';

export async function checkBackupEntryStatus() {
  if (!(await backgroundApiProxy.serviceCloudBackup.getCloudAvailable())) {
    Dialog.confirm({
      icon: 'InfoCircleOutline',
      title: `${backupPlatform().cloudName} Backup`,
      description: `Please log in to your Apple account and activate the ${
        backupPlatform().cloudName
      } Drive feature before proceeding.`,
      onConfirmText: 'Go System Settings',
      onConfirm: () => openSettings('default'),
    });
    throw new Error('cloud backup is not available');
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
