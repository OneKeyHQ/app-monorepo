import type { ComponentType } from 'react';

import {
  type GetProps,
  type SizeTokens,
  TMLabel,
  styled,
} from '@onekeyhq/components/src/shared/tamagui';

export type ILabelProps = Omit<GetProps<typeof TMLabel>, 'variant'> & {
  variant?: SizeTokens;
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
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return {
          fontSize: resolvedFont?.size[variant as ISizeType] || '$true',
          lineHeight: font?.lineHeight[variant],
          fontWeight: font?.weight[variant],
          textTransform: font?.transform[variant],
          letterSpacing: font?.letterSpacing[variant] as any,
        } as any;
      },
    },
  } as const,

  defaultVariants: {
    variant: '$bodyMdMedium' as any,
  },
}) as ComponentType<ILabelProps>;
