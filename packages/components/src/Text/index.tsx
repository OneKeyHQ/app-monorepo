// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { GetProps, styled } from '@tamagui/web';
import { Text as TextComponent } from 'tamagui';

export type TextProps = GetProps<typeof TextComponent>;

export const Text = styled(TextComponent, {
  variants: {
    variant: {
      '...size': (size, { font }) => ({
        fontFamily:
          size === '$bodyMdMono' || size === '$bodyLgMono'
            ? 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
            : '$body',
        fontSize: font?.size[size],
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
