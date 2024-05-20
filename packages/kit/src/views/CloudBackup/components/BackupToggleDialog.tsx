import { useState } from 'react';

import { Dialog } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { cloudBackupPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { backupPlatform } from '@onekeyhq/shared/src/cloudfs';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { checkBackupEntryStatus } from './CheckBackupEntryStatus';

async function backupToggleAction(
  willIsEnabled: boolean,
  callback?: (isEnabled: boolean) => void,
) {
  if (willIsEnabled) {
    await checkBackupEntryStatus();
  }
  await cloudBackupPersistAtom.set({
    ...(await cloudBackupPersistAtom.get()),
    isEnabled: willIsEnabled,
    ...(willIsEnabled
      ? { isFirstEnabled: false, isInProgress: true }
      : { isFirstDisabled: false, isInProgress: false }),
  });
  if (!willIsEnabled && platformEnv.isNativeAndroid) {
    await backgroundApiProxy.serviceCloudBackup.logoutFromGoogleDrive(false);
  }
  callback?.(willIsEnabled);
}

function BackupToggleDialogFooter({
  willIsEnabled,
  callback,
}: {
  willIsEnabled: boolean;
  callback?: (isEnabled: boolean) => void;
}) {
  const [loading, setLoading] = useState(false);

  return (
    <Dialog.Footer
      confirmButtonProps={{
        loading,
      }}
      onConfirmText={`Turn ${!willIsEnabled ? 'Off' : 'On'}`}
      onConfirm={async () => {
        try {
          setLoading(true);
          await backupToggleAction(willIsEnabled, callback);
          await timerUtils.wait(500);
        } catch (e) {
          //
        } finally {
          setLoading(false);
        }
      }}
    />
  );
}

export async function maybeShowBackupToggleDialog(willIsEnabled: boolean) {
  if (!platformEnv.isNative) {
    return;
  }
  const cloudBackupValueList = await cloudBackupPersistAtom.get();
  if (willIsEnabled === cloudBackupValueList.isEnabled) {
    return;
  }
  if (
    (willIsEnabled && !cloudBackupValueList.isFirstEnabled) ||
    (!willIsEnabled && !cloudBackupValueList.isFirstDisabled)
  ) {
    await backupToggleAction(willIsEnabled);
    return;
  }
  return new Promise((resolve) => {
    Dialog.show({
      icon: 'CloudSyncOutline',
      title: `${backupPlatform().cloudName} Backup`,
      description: !willIsEnabled
        ? `${
            backupPlatform().cloudName
          } Backup securely syncs your data across devices (excluding hardware wallets), ensuring that both OneKey and Apple cannot access your wallets. Backups are stored in ${
            backupPlatform().cloudName
          } Drive and can be enabled anytime.`
        : `${
            backupPlatform().cloudName
          } Backup securely syncs your data across devices (excluding hardware wallets), ensuring that both OneKey and Apple cannot access your wallets.`,
      renderContent: (
        <BackupToggleDialogFooter
          willIsEnabled={willIsEnabled}
          callback={resolve}
        />
      ),
    });
  });
}
