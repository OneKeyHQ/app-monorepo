import { useState } from 'react';

import {
  Button,
  Icon,
  Page,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';

import { OnboardingLayout } from '../components/OnboardingLayout';

export default function ICloudBackup() {
  const [loading, setLoading] = useState(false);

  const handleRestore = () => {
    setLoading(true);
    // TODO: Implement iCloud restore logic
    console.log('Restore from iCloud');
  };

  return (
    <Page>
      <OnboardingLayout>
        <OnboardingLayout.Header title="iCloud Backup" />
        <OnboardingLayout.Body>
          <YStack gap="$5">
            <YStack
              bg="$bgInfo"
              borderRadius="$4"
              borderCurve="continuous"
              p="$4"
              gap="$3"
            >
              <XStack gap="$3" alignItems="center">
                <Icon name="CloudOutline" size="$6" color="$iconInfo" />
                <SizableText size="$headingMd" color="$textInfo">
                  iCloud Backup
                </SizableText>
              </XStack>
              <SizableText size="$bodyMd" color="$textInfo">
                Restore your OneKey wallet from iCloud backup. Your encrypted
                wallet data will be safely restored to this device.
              </SizableText>
            </YStack>

            <YStack gap="$3" py="$2">
              <SizableText size="$headingSm">Before you continue</SizableText>
              <YStack gap="$2">
                <XStack gap="$3" alignItems="flex-start">
                  <Icon name="CheckboxSolid" size="$5" color="$iconSuccess" />
                  <SizableText size="$bodyMd" color="$textSubdued" flex={1}>
                    Make sure you're logged in to the correct iCloud account
                  </SizableText>
                </XStack>
                <XStack gap="$3" alignItems="flex-start">
                  <Icon name="CheckboxSolid" size="$5" color="$iconSuccess" />
                  <SizableText size="$bodyMd" color="$textSubdued" flex={1}>
                    Ensure you have a stable internet connection
                  </SizableText>
                </XStack>
                <XStack gap="$3" alignItems="flex-start">
                  <Icon name="CheckboxSolid" size="$5" color="$iconSuccess" />
                  <SizableText size="$bodyMd" color="$textSubdued" flex={1}>
                    Your backup password will be required to decrypt the wallet
                  </SizableText>
                </XStack>
              </YStack>
            </YStack>

            <YStack
              gap="$3"
              p="$4"
              borderRadius="$3"
              borderCurve="continuous"
              borderWidth={1}
              borderColor="$borderSubdued"
              bg="$bgSubdued"
            >
              <XStack gap="$2" alignItems="center">
                <Icon name="InfoCircleOutline" size="$5" color="$iconSubdued" />
                <SizableText size="$bodyMdMedium" color="$text">
                  Security Notice
                </SizableText>
              </XStack>
              <SizableText size="$bodySm" color="$textSubdued">
                OneKey never stores your wallet password or private keys on our
                servers. All backup data is encrypted and stored securely in
                your personal iCloud storage.
              </SizableText>
            </YStack>
          </YStack>
        </OnboardingLayout.Body>
        <OnboardingLayout.Footer>
          <YStack w="100%" maxWidth={400} gap="$3">
            <Button
              size="large"
              variant="primary"
              onPress={handleRestore}
              loading={loading}
            >
              Restore from iCloud
            </Button>
          </YStack>
        </OnboardingLayout.Footer>
      </OnboardingLayout>
    </Page>
  );
}
