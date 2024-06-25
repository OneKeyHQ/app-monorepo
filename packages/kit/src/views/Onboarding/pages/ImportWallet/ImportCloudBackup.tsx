import { useIntl } from 'react-intl';

import { Empty, Page } from '@onekeyhq/components';
import BackupDeviceList from '@onekeyhq/kit/src/views/CloudBackup/components/BackupDeviceList';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export default function ImportCloudBackup() {
  const intl = useIntl();
  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({
          id: platformEnv.isNativeAndroid
            ? ETranslations.backup_import_from_google_drive
            : ETranslations.backup_import_from_icloud,
        })}
      />
      <Page.Body>
        <BackupDeviceList
          ListEmptyComponent={
            <Empty
              icon="SearchOutline"
              title={intl.formatMessage({ id: ETranslations.backup_no_data })}
              description={intl.formatMessage({
                id: platformEnv.isNativeAndroid
                  ? ETranslations.backup_no_available_google_drive_backups_to_import
                  : ETranslations.backup_no_available_icloud_backups_to_import,
              })}
            />
          }
        />
      </Page.Body>
    </Page>
  );
}
