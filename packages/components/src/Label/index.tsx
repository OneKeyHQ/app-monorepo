import { Label as TMLabel, styled } from 'tamagui';

import type { GetProps } from 'tamagui';

export const Label = styled(TMLabel, {
  unstyled: true,

  variants: {
    variant: {
      '...size': (variant, { font }) => {
        const defaultFont = { size: {}, lineHeight: {}, weight: {} };
        const resolvedFont = font || defaultFont;
        type ISizeType = keyof typeof resolvedFont.size;

        return {
          fontSize: resolvedFont?.size[variant as ISizeType] || '$true',
          lineHeight: font?.lineHeight[variant],
          fontWeight: font?.weight[variant],
          textTransform: font?.transform[variant],
          letterSpacing: font?.letterSpacing[variant],
        };
      },
    },
  } as const,

  defaultVariants: {
    variant: '$bodyMdMedium',
  },
});

export type ILabelProps = GetProps<typeof Label>;
