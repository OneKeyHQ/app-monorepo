import { useState } from 'react';

import { Button, Page, SizableText, Stack, Switch } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useCloudBackupPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { backupPlatform } from '@onekeyhq/shared/src/cloudfs';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import BackupDeviceList from '../../components/BackupDeviceList';
import { maybeShowBackupToggleDialog } from '../../components/BackupToggleDialog';

export default function Home() {
  const [{ isEnabled, isInProgress }] = useCloudBackupPersistAtom();
  const [submitError, setSubmitError] = useState('');

  const navigation = useAppNavigation();

  return (
    <Page>
      <Page.Body>
        <BackupDeviceList
          ListHeaderComponent={
            <ListItem title={`Backup to ${backupPlatform().cloudName}`}>
              <Stack
                pointerEvents="box-only"
                onPress={async () => {
                  await maybeShowBackupToggleDialog(!isEnabled);
                  if (isEnabled && platformEnv.isNativeAndroid) {
                    navigation.pop();
                  }
                }}
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
