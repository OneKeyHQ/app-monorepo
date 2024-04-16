import { Empty, Page } from '@onekeyhq/components';
import BackupDeviceList from '@onekeyhq/kit/src/views/CloudBackup/components/BackupDeviceList';

export default function ImportCloudBackup() {
  return (
    <Page>
      <Page.Header title="Import from iCloud" />
      <Page.Body>
        <BackupDeviceList
          ListEmptyComponent={
            <Empty
              icon="SearchOutline"
              title="No Data"
              description="You have no available iCloud backups to import."
            />
          }
        />
      </Page.Body>
    </Page>
  );
}
