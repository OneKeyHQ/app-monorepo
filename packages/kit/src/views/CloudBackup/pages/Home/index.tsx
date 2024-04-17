import { useState } from 'react';

import { Button, Page, SizableText, Stack, Switch } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useCloudBackupPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import BackupDeviceList from '../../components/BackupDeviceList';
import { maybeShowBackupToggleDialog } from '../../components/BackupToggleDialog';

import { backupPlatform } from '@onekeyhq/shared/src/cloudfs';

export default function Home() {
  const [{ isEnabled, isInProgress }] = useCloudBackupPersistAtom();
  const [submitError, setSubmitError] = useState('');

  return (
    <Page>
      <Page.Body>
        <BackupDeviceList
          ListHeaderComponent={
            <ListItem title={`Backup to ${backupPlatform().cloudName}`}>
              <Stack
                pointerEvents="box-only"
                onPress={() => maybeShowBackupToggleDialog(!isEnabled)}
              >
                <Switch value={isEnabled} />
              </Stack>
            </ListItem>
          }
        />
        <Stack m="$5">
          {submitError?.length > 0 ? (
            <SizableText size="$bodyMd" color="$textCritical">
              {submitError}
            </SizableText>
          ) : null}
          <Button
            mt="$4"
            borderRadius="$3"
            py="$3"
            loading={isInProgress}
            onPress={async () => {
              await maybeShowBackupToggleDialog(true);
              setSubmitError('');
              try {
                await backgroundApiProxy.serviceCloudBackup.backupNow();
              } catch (e) {
                setSubmitError('Sync failed, please retry.');
              }
            }}
          >
            Backup Now
          </Button>
        </Stack>
      </Page.Body>
    </Page>
  );
}
