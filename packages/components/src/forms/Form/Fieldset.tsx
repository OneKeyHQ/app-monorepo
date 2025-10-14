import { YStack, styled } from '@onekeyhq/components/src/shared/tamagui';
import type { GetProps } from '@onekeyhq/components/src/shared/tamagui';

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
