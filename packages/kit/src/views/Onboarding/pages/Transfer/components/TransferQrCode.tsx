import { Stack } from '@onekeyhq/components';

import {
  SizableText,
  YStack,
  XStack,
  Image,
  Icon,
  Divider,
  useClipboard,
  Toast,
} from '@onekeyhq/components';
import { TransferSteps } from './TransferSteps';
import { useCallback, useState } from 'react';

export function TransferQrCode() {
  const { copyText } = useClipboard();

  const copyLink = useCallback(() => {
    copyText('192.168.5.178:2997');

    Toast.success({
      title: 'Copied',
    });
  }, [copyText]);

  return (
    <YStack gap="$6">
      <YStack gap="$2.5" alignItems="center">
        <Stack height="$60" width="$60" bg="$gray4">
          <Image height="$60" width="$60" />
        </Stack>

        <XStack
          gap="$2"
          onPress={copyLink}
          alignItems="center"
          hoverStyle={{
            opacity: 0.8,
            cursor: 'pointer',
          }}
        >
          <Icon name="Link2Solid" size="$5" color="$iconSubdued" />
          <SizableText color="$text" size="$bodyLgMedium">
            192.168.5.178:2997
          </SizableText>
        </XStack>
      </YStack>

      <TransferSteps />

      <Divider />

      <SizableText size="$bodySm" color="$textSubdued">
        OneKey doesn't back up hardware wallets, please record and safeguard
        your recovery phrase.
      </SizableText>
    </YStack>
  );
}
