import type { ReactNode } from 'react';

import { SizableText, Stack, XStack, YStack } from '@onekeyhq/components';

const StepperNumber = ({ children }: { children: ReactNode }) => (
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

type IStepperProps = {
  index: number;
  title: string;
  description?: string;
};

export function Step({ index, title, description }: IStepperProps) {
  return (
    <XStack gap="$2">
      <StepperNumber>{index}</StepperNumber>
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

export function Stepper({ children }: { children: ReactNode }) {
  return <YStack gap="$2">{children}</YStack>;
}

export default {
  Step,
  Stepper,
};
