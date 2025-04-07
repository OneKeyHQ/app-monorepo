import { useIntl } from 'react-intl';

import { Button, Divider, Page, Stack, Switch } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useCloudBackupPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import BackupDeviceList from '../../components/BackupDeviceList';
import GoogleDriveBackupSunsettingAlert from '../../components/GoogleDriveBackupSunsettingAlert';
import { useBackupCurrentUserEmail } from '../../components/useBackupCurrentUserEmail';
import { useBackupToggleAction } from '../../components/useBackupToggleDialog';

export function NewCloudBackupHome() {
  const intl = useIntl();
  const [{ isEnabled }] = useCloudBackupPersistAtom();
  const backupToggleAction = useBackupToggleAction();
  const currentUserEmail = useBackupCurrentUserEmail();

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
        <GoogleDriveBackupSunsettingAlert />

        <BackupDeviceList
          ListHeaderComponent={
            <>
              <ListItem
                title={intl.formatMessage({
                  id: platformEnv.isNativeAndroid
                    ? ETranslations.backup_enable_google_drive
                    : ETranslations.backup_enable_icloud,
                })}
                subtitle={currentUserEmail}
              >
                <Stack
                  pointerEvents="box-only"
                  onPress={async () => {
                    await backupToggleAction.toggle(!isEnabled);
                  }}
                >
                  <Switch value={isEnabled} />
                </Stack>
              </ListItem>

              <Divider pt="$6" />
            </>
          }
        />
        <Stack m="$5">
          <Button mt="$4" borderRadius="$3" py="$3" disabled>
            {intl.formatMessage({ id: ETranslations.backup_backup_now })}
          </Button>
        </Stack>
      </Page.Body>
    </Page>
  );
}
