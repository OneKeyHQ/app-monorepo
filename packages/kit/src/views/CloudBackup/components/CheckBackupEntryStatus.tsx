import { Dialog } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { openSettings } from '@onekeyhq/shared/src/utils/openUrlUtils';

export async function checkBackupEntryStatus() {
  if (!(await backgroundApiProxy.serviceCloudBackup.getCloudAvailable())) {
    Dialog.confirm({
      icon: 'InfoCircleOutline',
      title: 'iCloud Backup',
      description:
        'Please log in to your Apple account and activate the iCloud Drive feature before proceeding.',
      onConfirmText: 'Go System Settings',
      onConfirm: () => openSettings('default'),
    });
    throw new Error('cloud backup is not available');
  }
  await backgroundApiProxy.serviceCloudBackup.loginIfNeeded(true);
}
