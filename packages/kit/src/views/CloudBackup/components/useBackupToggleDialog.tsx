import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import { Dialog } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { cloudBackupPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { useBackupEntryStatus } from './useBackupEntryStatus';

function useBackupToggleAction() {
  const backupEntryStatus = useBackupEntryStatus();
  const toggle = useCallback(
    async (willIsEnabled: boolean, callback?: (isEnabled: boolean) => void) => {
      if (willIsEnabled) {
        await backupEntryStatus.check();
      }
      await cloudBackupPersistAtom.set({
        ...(await cloudBackupPersistAtom.get()),
        isEnabled: willIsEnabled,
        ...(willIsEnabled
          ? { isFirstEnabled: false, isInProgress: true }
          : { isFirstDisabled: false, isInProgress: false }),
      });
      if (!willIsEnabled && platformEnv.isNativeAndroid) {
        await backgroundApiProxy.serviceCloudBackup.logoutFromGoogleDrive(
          false,
        );
      }
      callback?.(willIsEnabled);
    },
    [backupEntryStatus],
  );
  return useMemo(() => ({ toggle }), [toggle]);
}

function BackupToggleDialogFooter({
  willIsEnabled,
  callback,
}: {
  willIsEnabled: boolean;
  callback?: (isEnabled: boolean) => void;
}) {
  const intl = useIntl();
  const backupToggleAction = useBackupToggleAction();
  const [loading, setLoading] = useState(false);

  return (
    <Dialog.Footer
      confirmButtonProps={{
        loading,
      }}
      onConfirmText={intl.formatMessage({
        id: !willIsEnabled
          ? ETranslations.backup_turn_off
          : ETranslations.backup_turn_on,
      })}
      onConfirm={async () => {
        try {
          setLoading(true);
          await backupToggleAction.toggle(willIsEnabled, callback);
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

export function useBackupToggleDialog() {
  const intl = useIntl();
  const backupToggleAction = useBackupToggleAction();
  const maybeShow = useCallback(
    async (willIsEnabled: boolean) => {
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
        await backupToggleAction.toggle(willIsEnabled);
        return;
      }
      return new Promise((resolve) => {
        Dialog.show({
          icon: 'CloudSyncOutline',
          title: intl.formatMessage({
            id: ETranslations.settings_icloud_backup,
          }),
          description: intl.formatMessage({
            id: platformEnv.isNativeAndroid
              ? ETranslations.backup_google_drive_securely_syncs_data
              : ETranslations.backup_icloud_backup_securely_syncs_your_data,
          }),
          renderContent: (
            <BackupToggleDialogFooter
              willIsEnabled={willIsEnabled}
              callback={resolve}
            />
          ),
        });
      });
    },
    [intl, backupToggleAction],
  );
  return useMemo(() => ({ maybeShow }), [maybeShow]);
}
