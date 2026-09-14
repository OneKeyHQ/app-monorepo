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
  useClipboard,
  useDialogInstance,
} from '@onekeyhq/components';
import { MultipleClickStack } from '@onekeyhq/kit/src/components/MultipleClickStack';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { downloadAsFile } from '../../../utils/downloadAsFile';
import { OnboardingTestIDs } from '../testIDs';

import { showCloudBackupPasswordDialog } from './CloudBackupDialogs';

function KeylessWalletBackupDetails({
  backupRecordId,
}: {
  backupRecordId?: string;
}) {
  const intl = useIntl();
  const provider = platformEnv.isNativeAndroid ? 'Google Drive' : 'iCloud';
  const dialog = useDialogInstance();

  const { copyText } = useClipboard();
  const handleDownload = useCallback(() => {
    if (!backupRecordId) {
      throw new OneKeyLocalError('Backup record ID is required');
    }
    const passwordDialog = showCloudBackupPasswordDialog({
      intl,
      isRestoreAction: true,
      description:
        'Enter your cloud backup password to export a ZIP with a new, random extraction password. The JSON inside contains decrypted wallet data.',
      onSubmit: async (password) => {
        const { default: backgroundApiProxy } =
          await import('@onekeyhq/kit/src/background/instance/backgroundApiProxy');
        const { archiveBase64, password: zipPassword } =
          await backgroundApiProxy.serviceCloudBackupV2.exportBackupArchive({
            recordId: backupRecordId,
            password,
          });
        if (!passwordDialog.isExist()) return;
        await passwordDialog.close();
        await downloadAsFile({
          content: archiveBase64,
          filename: `onekey-cloud-backup-${Date.now()}.zip`,
          encoding: 'base64',
          mimeType: 'application/zip',
          UTI: 'public.zip-archive',
        });
        // Native sharing resolves on dismissal, including cancellation.
        Dialog.show({
          title: 'ZIP extraction password',
          description:
            'Copy and save this password to extract this ZIP. Every export generates a new password.',
          dismissOnOverlayPress: false,
          renderContent: (
            <YStack gap="$4">
              <SizableText userSelect="text" textAlign="center">
                {zipPassword}
              </SizableText>
              <Button
                testID="cloud-backup-copy-zip-password"
                onPress={() => copyText(zipPassword)}
              >
                Copy password
              </Button>
            </YStack>
          ),
          showCancelButton: false,
          onConfirmText: intl.formatMessage({ id: ETranslations.global_done }),
        });
      },
    });
  }, [backupRecordId, copyText, intl]);

  const [isDownloading, setIsDownloading] = useState(false);
  const handleDownloadPress = useCallback(async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    try {
      await dialog.close();
      handleDownload();
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
