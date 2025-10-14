import { styled } from '../../shared/tamagui';
import { YStack } from '../../shared/tamagui';

import type { GetProps } from '../../shared/tamagui';

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
