import { useCallback, useState } from 'react';

import { Button, Divider, Page, Stack, Switch } from '@onekeyhq/components';
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

  const backupNowOnPress = useCallback(async () => {
    await maybeShowBackupToggleDialog(true);
    setSubmitError('');
    try {
      await backgroundApiProxy.serviceCloudBackup.backupNow();
    } catch (e) {
      setSubmitError('Sync failed, please retry.');
    }
  }, []);

  const renderBackupStatus = useCallback(() => {
    if (isInProgress) {
      return (
        <Button disabled bg="transparent" p="0" loading>
          Syncing...
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
          Sync error
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
        Synced
      </Button>
    );
  }, [isInProgress, submitError]);

  return (
    <Page>
      <Page.Body>
        <BackupDeviceList
          ListHeaderComponent={
            <>
              <ListItem title={`Enable ${backupPlatform().cloudName} backup`}>
                <Stack
                  pointerEvents="box-only"
                  onPress={async () => {
                    await maybeShowBackupToggleDialog(!isEnabled);
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
                  title={`${backupPlatform().cloudName} Status`}
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
            Backup Now
          </Button>
        </Stack>
      </Page.Body>
    </Page>
  );
}
