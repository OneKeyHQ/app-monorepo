import type { ReactNode } from 'react';

import { SizableText, Stack, XStack, YStack } from '@onekeyhq/components';

const StepNumber = ({ children }: { children: ReactNode }) => (
  <Stack
    width="$8"
    height="$8"
    borderRadius="$full"
    backgroundColor="$bgInfo"
    alignItems="center"
    justifyContent="center"
  >
    <SizableText size="$bodyMd" color="$info11">
      {children}
    </SizableText>
  </Stack>
);

export function TransferSteps() {
  return (
    <YStack gap="$2">
      <XStack gap="$2" alignItems="center">
        <StepNumber>1</StepNumber>
        <SizableText size="$bodyMd" color="$text">
          Keep devices on same network
        </SizableText>
      </XStack>

      <XStack gap="$2" alignItems="center">
        <StepNumber>2</StepNumber>
        <SizableText size="$bodyMd" color="$text">
          Open OneKey on another device
        </SizableText>
      </XStack>

      <XStack gap="$2" alignItems="center">
        <StepNumber>3</StepNumber>
        <YStack gap="$1">
          <SizableText size="$bodyMd" color="$text">
            Scan the QR code on this page.
          </SizableText>

          <SizableText width="100%" size="$bodyMd" color="$textSubdued">
            {`Alternatively, go to "Wallet > Account > Add wallet" and click "Transfer." Then, paste the link below the QR code`}
          </SizableText>
        </YStack>
      </XStack>
    </YStack>
  );
}
