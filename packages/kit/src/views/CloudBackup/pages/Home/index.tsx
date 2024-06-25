import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import { Button, Divider, Page, Stack, Switch } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useCloudBackupPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import BackupDeviceList from '../../components/BackupDeviceList';
import { useBackupToggleDialog } from '../../components/useBackupToggleDialog';

export default function Home() {
  const intl = useIntl();
  const backupToggleDialog = useBackupToggleDialog();
  const [{ isEnabled, isInProgress }] = useCloudBackupPersistAtom();
  const [submitError, setSubmitError] = useState('');

  const navigation = useAppNavigation();

  const backupNowOnPress = useCallback(async () => {
    await backupToggleDialog.maybeShow(true);
    setSubmitError('');
    try {
      await backgroundApiProxy.serviceCloudBackup.backupNow();
    } catch (e) {
      setSubmitError('Sync failed, please retry.');
    }
  }, [backupToggleDialog]);

  const renderBackupStatus = useCallback(() => {
    if (isInProgress) {
      return (
        <Button disabled bg="transparent" p="0" loading>
          {intl.formatMessage({ id: ETranslations.global_syncing })}
        </Button>
      );
    }
    if (submitError) {
      return (
        <Button
          disabled
          bg="transparent"
          p="0"
          icon="XCircleSolid"
          iconColor="$iconCritical"
        >
          {intl.formatMessage({ id: ETranslations.global_sync_error })}
        </Button>
      );
    }
    return (
      <Button
        disabled
        bg="transparent"
        p="0"
        icon="CheckRadioSolid"
        iconColor="$iconSuccess"
      >
        {intl.formatMessage({ id: ETranslations.global_synced })}
      </Button>
    );
  }, [intl, isInProgress, submitError]);

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({
          id: platformEnv.isNativeAndroid
            ? ETranslations.settings_google_drive_backup
            : ETranslations.settings_icloud_backup,
        })}
      />
      <Page.Body>
        <BackupDeviceList
          ListHeaderComponent={
            <>
              <ListItem
                title={intl.formatMessage({
                  id: platformEnv.isNativeAndroid
                    ? ETranslations.backup_backup_to_google_drive
                    : ETranslations.backup_backup_to_icloud,
                })}
              >
                <Stack
                  pointerEvents="box-only"
                  onPress={async () => {
                    await backupToggleDialog.maybeShow(!isEnabled);
                    if (!isEnabled) {
                      await backupNowOnPress();
                    } else if (platformEnv.isNativeAndroid) {
                      navigation.pop();
                    }
                  }}
                >
                  <Switch value={isEnabled} />
                </Stack>
              </ListItem>
              {isEnabled ? (
                <ListItem
                  pt="$3"
                  title={intl.formatMessage({
                    id: platformEnv.isNativeAndroid
                      ? ETranslations.backup_google_drive_status
                      : ETranslations.backup_icloud_status,
                  })}
                >
                  {renderBackupStatus()}
                </ListItem>
              ) : null}
              <Divider pt="$6" />
            </>
          }
        />
        <Stack m="$5">
          <Button
            mt="$4"
            borderRadius="$3"
            py="$3"
            disabled={isInProgress}
            onPress={backupNowOnPress}
          >
            {intl.formatMessage({ id: ETranslations.backup_backup_now })}
          </Button>
        </Stack>
      </Page.Body>
    </Page>
  );
}
