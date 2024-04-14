import { useState } from 'react';

import { Dialog } from '@onekeyhq/components';
import {
  cloudBackupPersistAtom,
  useCloudBackupPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

function BackupToggleDialogFooter({
  willIsEnabled,
  callback,
}: {
  willIsEnabled: boolean;
  callback?: (isEnabled: boolean) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [cloudBackup, setCloudBackup] = useCloudBackupPersistAtom();
  return (
    <Dialog.Footer
      confirmButtonProps={{
        loading,
      }}
      onConfirmText={`Turn ${!willIsEnabled ? 'Off' : 'On'}`}
      onConfirm={async () => {
        try {
          setLoading(true);
          await timerUtils.wait(500);
          setCloudBackup({ ...cloudBackup, isEnabled: willIsEnabled });
          callback?.(willIsEnabled);
        } finally {
          setLoading(false);
        }
      }}
    />
  );
}

export async function maybeShowBackupToggleDialog(willIsEnabled: boolean) {
  if (willIsEnabled === (await cloudBackupPersistAtom.get()).isEnabled) {
    return;
  }
  return new Promise((resolve) => {
    Dialog.show({
      icon: 'CloudSyncOutline',
      title: 'iCloud Backup',
      description: !willIsEnabled
        ? 'iCloud Backup securely syncs your data across devices (excluding hardware wallets), ensuring that both OneKey and Apple cannot access your wallets. Backups are stored in iCloud Drive and can be enabled anytime.'
        : 'iCloud Backup securely syncs your data across devices (excluding hardware wallets), ensuring that both OneKey and Apple cannot access your wallets.',
      renderContent: (
        <BackupToggleDialogFooter
          willIsEnabled={willIsEnabled}
          callback={resolve}
        />
      ),
    });
  });
}
