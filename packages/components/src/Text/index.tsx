import { Text as OriginText, styled } from 'tamagui';

import type { GetProps, SizeTokens } from 'tamagui';

export const Text = styled(OriginText, {
  name: 'Text',
  fontFamily: '$body',

  variants: {
    variant: {
      '...size': (variant, { font }) => {
        const defaultFont = { size: {}, lineHeight: {}, weight: {} };
        const resolvedFont = font || defaultFont;
        type SizeType = keyof typeof resolvedFont.size;

        return {
          fontSize: resolvedFont?.size[variant as SizeType] || '$true',
          lineHeight: font?.lineHeight[variant],
          fontWeight: font?.weight[variant],
          textTransform: font?.transform[variant],
          letterSpacing: font?.letterSpacing[variant],
        };
      },
    },
  } as const,

  defaultVariants: {
    variant: '$true',
  },
});

export type TextProps = GetProps<typeof Text>;
