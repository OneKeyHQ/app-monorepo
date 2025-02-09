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
      <XStack gap="$2">
        <StepNumber>1</StepNumber>
        <SizableText size="$bodyMd" color="$text" pt="$1.5">
          Keep devices on same network
        </SizableText>
      </XStack>

      <XStack gap="$2">
        <StepNumber>2</StepNumber>
        <SizableText size="$bodyMd" color="$text" pt="$1.5">
          Open OneKey on another device
        </SizableText>
      </XStack>

      <XStack gap="$2">
        <StepNumber>3</StepNumber>
        <Stack gap="$1" flex={1}>
          <SizableText size="$bodyMd" color="$text" pt="$1.5">
            Scan the QR code on this page.
          </SizableText>

          <SizableText size="$bodyMd" color="$textSubdued">
            {`Alternatively, go to "Wallet > Account > Add wallet" and click "Transfer." Then, paste the link below the QR code`}
          </SizableText>
        </Stack>
      </XStack>
    </YStack>
  );
}
