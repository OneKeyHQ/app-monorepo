import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Dialog,
  Divider,
  Page,
  SizableText,
  Stack,
  Switch,
  Toast,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { MultipleClickStack } from '@onekeyhq/kit/src/components/MultipleClickStack';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useCloudBackupPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
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
      console.log('backupNowOnPress');
      // await backgroundApiProxy.serviceCloudBackup.backupNow();
    } catch (e) {
      setSubmitError('Sync failed, please retry.');
      Toast.error({
        // @ts-expect-error
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        title: `${e?.message ?? e}`,
      });
    }
    defaultLogger.setting.page.backup({
      backupMethod: platformEnv.isNativeAndroid ? 'Google' : 'iCloud',
    });
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
        <BackupDeviceList />
        <MultipleClickStack
          height="$10"
          showDevBgColor
          debugComponent={
            <YStack gap="$2">
              <Button
                onPress={async () => {
                  const metaData =
                    await backgroundApiProxy.serviceCloudBackup.getMetaDataFromCloud();
                  Dialog.debugMessage({
                    debugMessage: metaData,
                  });
                }}
              >
                getMetaDataFromCloud
              </Button>
            </YStack>
          }
        />
      </Page.Body>
    </Page>
  );
}
