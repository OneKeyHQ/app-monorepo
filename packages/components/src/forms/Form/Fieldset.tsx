import { styled } from '@tamagui/core';
import { YStack } from '@tamagui/stacks';

import type { GetProps } from '@tamagui/core';

export const Fieldset = styled(YStack, {
  name: 'Fieldset',
  tag: 'fieldset',

  variants: {
    horizontal: {
      true: {
        flexDirection: 'row',
        alignItems: 'center',
      },
    },
  } as const,
});

export type IFieldsetProps = GetProps<typeof Fieldset>;
