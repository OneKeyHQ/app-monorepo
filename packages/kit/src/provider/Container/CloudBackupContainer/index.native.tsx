import { useEffect } from 'react';

import { Dialog } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { openSettings } from '@onekeyhq/shared/src/utils/openUrlUtils';

export function CloudBackupContainer() {
  useEffect(() => {
    void backgroundApiProxy.serviceCloudBackup
      .checkCloudBackupStatus()
      .then((isValid) => {
        if (isValid) {
          return;
        }
        Dialog.show({
          icon: 'InfoCircleOutline',
          title: 'iCloud Auto-backup Paused',
          description:
            'Please verify your Apple account login and ensure iCloud Drive is enabled and authorized for OneKey.',
          onConfirmText: 'Go Settings',
          onCancelText: 'Close',
          onConfirm: () => openSettings('default'),
        });
      });
  }, []);
}
