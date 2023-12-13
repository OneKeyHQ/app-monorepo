import { Text as OriginText, styled } from 'tamagui';

import type { GetProps } from 'tamagui';

export const Text = styled(OriginText, {
  name: 'Text',
  fontFamily: '$body',
  userSelect: 'none',

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
          letterSpacing: font?.letterSpacing[variant],
        };
      },
    },
    tone: {
      subdued: {
        color: '$textSubdued',
      },
      success: {
        color: '$textSuccess',
      },
      caution: {
        color: '$textCaution',
      },
      critical: {
        color: '$textCritical',
      },
    },
  } as const,

  defaultVariants: {
    variant: '$true',
  },
});

export type ITextProps = GetProps<typeof Text>;
