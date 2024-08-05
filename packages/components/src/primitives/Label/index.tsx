import type { ComponentType } from 'react';

import { Label as TMLabel, styled } from 'tamagui';

import type { GetProps, SizeTokens } from 'tamagui';

export type ILabelProps = Omit<GetProps<typeof TMLabel>, 'variant'> & {
  variant: SizeTokens;
};

export const Label = styled(TMLabel, {
  unstyled: true,
  color: '$text',
  variants: {
    variant: {
      ':string': (variant, { font }) => {
        const defaultFont = { size: {}, lineHeight: {}, weight: {} };
        const resolvedFont = font || defaultFont;
        type ISizeType = keyof typeof resolvedFont.size;
        return {
          fontSize: resolvedFont?.size[variant as ISizeType] || '$true',
          lineHeight: font?.lineHeight[variant],
          fontWeight: font?.weight[variant],
          textTransform: font?.transform[variant],
          letterSpacing: font?.letterSpacing[variant] as any,
        };
      },
    },
  } as const,

  defaultVariants: {
    variant: '$bodyMdMedium',
  },
}) as ComponentType<ILabelProps>;
