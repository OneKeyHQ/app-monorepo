import { useState } from 'react';

import { Dialog, Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { backupPlatform } from '@onekeyhq/shared/src/cloudfs';

function DeleteBackupDialogFooter({
  filename,
  callback,
}: {
  filename: string;
  callback?: () => void;
}) {
  const [loading, setLoading] = useState(false);
  return (
    <Dialog.Footer
      confirmButtonProps={{
        loading,
      }}
      tone="destructive"
      onConfirmText="Delete"
      onConfirm={async () => {
        try {
          setLoading(true);
          await backgroundApiProxy.serviceCloudBackup.removeBackup(filename);
          callback?.();
          Toast.message({
            title: 'Backup Deleted',
          });
        } finally {
          setLoading(false);
        }
      }}
    />
  );
}

export function showDeleteBackupDialog(filename: string) {
  return new Promise<void>((resolve) => {
    Dialog.show({
      title: 'Delete this Backup?',
      icon: 'DeleteOutline',
      description: `This file will be permanently deleted from ${
        backupPlatform().cloudName
      }. Make sure you have wrtten down the recovery phrases as you won’t be able to restore the wallets otherwise.`,
      tone: 'destructive',
      renderContent: (
        <DeleteBackupDialogFooter filename={filename} callback={resolve} />
      ),
    });
  });
}
