import { Text as OriginText, styled } from 'tamagui';

export const Text = styled(OriginText, {
  variants: {
    variant: {
      '...size': (size, { font }) => ({
        fontFamily:
          size === '$bodyMdMono' || size === '$bodyLgMono'
            ? 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
            : '$body',
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
