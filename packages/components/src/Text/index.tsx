import { Text as OriginText, styled } from 'tamagui';

import type { GetProps, SizeTokens } from 'tamagui';

export type TextProps = GetProps<typeof OriginText>;

const getFont = (size: SizeTokens) =>
  size === '$bodyMdMono' || size === '$bodyLgMono'
    ? 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
    : '$body';

export const Text = styled(OriginText, {
  variants: {
    variant: {
      '...size': (size, { font }) => ({
        fontFamily:
          process.env.TAMAGUI_TARGET === 'native' ? 'System' : getFont(size),
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        fontSize: font?.size[size as any],
        lineHeight: font?.lineHeight[size],
        fontWeight: font?.weight[size],
        textTransform: size === '$headingXs' ? 'uppercase' : 'none',
        letterSpacing: size === '$headingXs' ? 0.8 : 0,
        textDecorationLine:
          size === '$bodyLgUnderline' || size === '$bodyMdUnderline'
            ? 'underline'
            : 'none',
      }),
    },
  } as const,

  defaultVariants: {
    variant: '$bodyLg',
  },
});
