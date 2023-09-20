// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { GetProps, styled } from '@tamagui/web';
import { Text as TextComponent } from 'tamagui';

export type TextProps = GetProps<typeof TextComponent>;

export const Text = styled(TextComponent, {
  variants: {
    variant: {
      '...fontSize': (fontSize, { font }) => ({
        fontFamily:
          fontSize === '$bodyMdMono' || fontSize === '$bodyLgMono'
            ? 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
            : '$body',
        fontSize: font?.size[fontSize],
        lineHeight: font?.lineHeight[fontSize],
        fontWeight: font?.weight[fontSize],
        textTransform: fontSize === '$headingXs' ? 'uppercase' : 'none',
        letterSpacing: fontSize === '$headingXs' ? 0.8 : 0,
        textDecorationLine:
          fontSize === '$bodyLgUnderline' || fontSize === '$bodyMdUnderline'
            ? 'underline'
            : 'none',
      }),
    },
  } as const,

  defaultVariants: {
    variant: '$bodyLg',
  },
});
