import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  Dialog,
  Icon,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { useKeylessWalletExistsLocal } from '@onekeyhq/kit/src/components/KeylessWallet/useKeylessWallet';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { OnboardingTestIDs } from '../testIDs';

export function KeylessWalletBackupInfo() {
  const intl = useIntl();
  const isKeylessWalletExistsLocal = useKeylessWalletExistsLocal();
  const isCloudBackupSupportedPlatform =
    platformEnv.isNativeIOS ||
    platformEnv.isNativeAndroid ||
    platformEnv.isDesktopMac;

  const handleShowDetails = useCallback(() => {
    const provider = platformEnv.isNativeAndroid ? 'Google Drive' : 'iCloud';

    Dialog.show({
      testID: OnboardingTestIDs.iCloudBackupKeylessWalletDialog,
      showHeader: false,
      showFooter: false,
      renderContent: (
        <YStack alignItems="center" px="$3" pt="$8" pb="$8">
          <Icon name="CloudOutline" size="$16" color="$iconSubdued" />
          <SizableText
            maxWidth="$80"
            mt="$8"
            size="$headingXl"
            textAlign="center"
          >
            {intl.formatMessage({
              id: ETranslations.backup_keyless_no_cloud_title,
            })}
          </SizableText>
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
      ),
    });
  }, [intl]);

  if (!isCloudBackupSupportedPlatform || !isKeylessWalletExistsLocal) {
    return null;
  }

  return (
    <XStack
      testID={OnboardingTestIDs.iCloudBackupKeylessWalletHint}
      accessibilityRole="button"
      cursor="pointer"
      userSelect="none"
      gap="$3"
      alignItems="flex-start"
      bg="$bgSubdued"
      borderRadius="$4"
      px="$4"
      py="$3"
      hoverStyle={{ bg: '$bgHover' }}
      pressStyle={{ bg: '$bgActive' }}
      onPress={handleShowDetails}
    >
      <Icon name="LockOutline" size="$5" color="$iconSubdued" mt="$0.5" />
      <SizableText size="$bodyMd" color="$textSubdued" flex={1}>
        {intl.formatMessage({
          id: ETranslations.backup_keyless_not_in_cloud_hint,
        })}
      </SizableText>
      <Icon name="InfoCircleOutline" size="$5" color="$iconSubdued" mt="$0.5" />
    </XStack>
  );
}
