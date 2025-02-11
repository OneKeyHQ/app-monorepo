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

type ITransferStepProps = {
  number: number;
  title: string;
  description?: string;
};

function TransferStep({ number, title, description }: ITransferStepProps) {
  return (
    <XStack gap="$2">
      <StepNumber>{number}</StepNumber>
      <Stack gap="$1" flex={1}>
        <SizableText size="$bodyMd" color="$text" pt="$1.5">
          {title}
        </SizableText>
        {description ? (
          <SizableText size="$bodyMd" color="$textSubdued">
            {description}
          </SizableText>
        ) : null}
      </Stack>
    </XStack>
  );
}

export function TransferSteps() {
  return (
    <YStack gap="$2">
      <TransferStep number={1} title="Keep devices on same network" />
      <TransferStep number={2} title="Open OneKey on another device" />
      <TransferStep
        number={3}
        title="Scan the QR code on this page."
        description='Alternatively, go to "Wallet > Account > Add wallet" and click "Transfer." Then, paste the link below the QR code'
      />
    </YStack>
  );
}
