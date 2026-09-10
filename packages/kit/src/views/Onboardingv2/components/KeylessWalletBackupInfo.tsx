import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Dialog,
  Icon,
  SizableText,
  Toast,
  XStack,
  YStack,
  useDialogInstance,
} from '@onekeyhq/components';
import { MultipleClickStack } from '@onekeyhq/kit/src/components/MultipleClickStack';
import type { IBackupDataExportPayload } from '@onekeyhq/shared/src/cloudBackup/cloudBackupTypes';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';

import { downloadAsFile } from '../../../utils/downloadAsFile';
import { OnboardingTestIDs } from '../testIDs';

function KeylessWalletBackupDetails({
  backupRecordId,
}: {
  backupRecordId?: string;
}) {
  const intl = useIntl();
  const provider = platformEnv.isNativeAndroid ? 'Google Drive' : 'iCloud';
  const dialog = useDialogInstance();

  const handleDownload = useCallback(async () => {
    if (!backupRecordId) {
      throw new OneKeyLocalError('Backup record ID is required');
    }
    const { default: backgroundApiProxy } =
      await import('@onekeyhq/kit/src/background/instance/backgroundApiProxy');
    const backup = await backgroundApiProxy.serviceCloudBackupV2.download({
      recordId: backupRecordId,
    });
    if (!backup?.content) {
      throw new OneKeyLocalError('Backup data is empty');
    }
    let content = backup.content;
    if (platformEnv.isNativeAndroid) {
      const { userId } =
        await backgroundApiProxy.serviceCloudBackupV2.getCloudAccountInfo();
      if (!userId) {
        throw new OneKeyLocalError(
          'Google user ID is required to export backup data',
        );
      }
      const payload: IBackupDataExportPayload = {
        ...backup.payload,
        googleUserId: userId,
      };
      content = stringUtils.stableStringify(payload);
    }
    await downloadAsFile({
      content,
      filename: `onekey-cloud-backup-${backupRecordId}.json`,
    });
  }, [backupRecordId]);

  const [isDownloading, setIsDownloading] = useState(false);
  const handleDownloadPress = useCallback(async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    try {
      await dialog.close();
      await handleDownload();
      // Native sharing resolves on dismissal, including cancellation.
      if (!platformEnv.isNative) {
        Toast.success({ title: 'Backup data downloaded' });
      }
    } catch (error) {
      errorToastUtils.toastIfErrorDisable(error);
      Toast.error({
        title: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsDownloading(false);
    }
  }, [dialog, handleDownload, isDownloading]);

  return (
    <YStack alignItems="center" px="$3" pt="$8" pb="$8">
      <Icon name="CloudOutline" size="$16" color="$iconSubdued" />
      <MultipleClickStack
        devSettingsOnly
        mt="$8"
        alignItems="center"
        testID={OnboardingTestIDs.iCloudBackupKeylessWalletDialogTitle}
        debugComponent={
          backupRecordId ? (
            <Button
              mt="$4"
              testID={OnboardingTestIDs.iCloudBackupDevDownloadDataBtn}
              loading={isDownloading}
              onPress={handleDownloadPress}
            >
              Download Backup Data
            </Button>
          ) : null
        }
      >
        <SizableText maxWidth="$80" size="$headingXl" textAlign="center">
          {intl.formatMessage({
            id: ETranslations.backup_keyless_no_cloud_title,
          })}
        </SizableText>
      </MultipleClickStack>
      <SizableText
        maxWidth="$80"
        mt="$4"
        size="$bodyLg"
        color="$textSubdued"
        textAlign="center"
      >
        {intl.formatMessage(
          { id: ETranslations.backup_keyless_no_cloud_google_desc },
          { provider },
        )}
      </SizableText>
    </YStack>
  );
}

export function KeylessWalletBackupInfo({
  backupRecordId,
}: {
  backupRecordId?: string;
}) {
  const intl = useIntl();
  const isCloudBackupSupportedPlatform =
    platformEnv.isNativeIOS ||
    platformEnv.isNativeAndroid ||
    platformEnv.isDesktopMac;

  const handleShowDetails = useCallback(() => {
    Dialog.show({
      testID: OnboardingTestIDs.iCloudBackupKeylessWalletDialog,
      showHeader: false,
      showFooter: false,
      renderContent: (
        <KeylessWalletBackupDetails backupRecordId={backupRecordId} />
      ),
    });
  }, [backupRecordId]);

  if (!isCloudBackupSupportedPlatform) {
    return null;
  }

  return (
    <YStack
      onPress={handleShowDetails}
      testID={OnboardingTestIDs.iCloudBackupKeylessWalletHint}
      accessibilityRole="button"
      bg="$bgSubdued"
      borderRadius="$4"
      px="$4"
      py="$3"
      cursor="pointer"
      hoverStyle={{ bg: '$bgHover' }}
      pressStyle={{ bg: '$bgActive' }}
    >
      <XStack userSelect="none" gap="$3" alignItems="flex-start">
        <Icon name="LockOutline" size="$5" color="$iconSubdued" mt="$0.5" />
        <SizableText size="$bodyMd" color="$textSubdued" flex={1}>
          {intl.formatMessage({
            id: ETranslations.backup_keyless_not_in_cloud_hint,
          })}
        </SizableText>
        <Icon
          name="InfoCircleOutline"
          size="$5"
          color="$iconSubdued"
          mt="$0.5"
        />
      </XStack>
    </YStack>
  );
}
