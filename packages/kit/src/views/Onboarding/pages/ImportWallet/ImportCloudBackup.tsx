import { Empty, Page } from '@onekeyhq/components';
import BackupDeviceList from '@onekeyhq/kit/src/views/CloudBackup/components/BackupDeviceList';
import { backupPlatform } from '@onekeyhq/shared/src/cloudfs';

export default function ImportCloudBackup() {
  return (
    <Page>
      <Page.Header title={`Import from ${backupPlatform().cloudName}`} />
      <Page.Body>
        <BackupDeviceList
          ListEmptyComponent={
            <Empty
              icon="SearchOutline"
              title="No Data"
              description={`You have no available ${
                backupPlatform().cloudName
              } backups to import.`}
            />
          }
        />
      </Page.Body>
    </Page>
  );
}
