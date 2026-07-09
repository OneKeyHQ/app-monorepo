import { SizableText as TamaguiSizableText } from '@tamagui/text';

import { type SizableTextProps } from '@onekeyhq/components/src/shared/tamagui';

import { getFontVariantStyle } from '../../utils/tabularNums';

export const StyledSizableText = TamaguiSizableText;

export function SizableText({
  size = '$bodyMd',
  fontVariant,
  style,
  ...props
}: SizableTextProps) {
  // Tamagui silently drops the RN `fontVariant` prop, so numeric variants
  // (tabular-nums etc.) never reach the renderer — re-route it through the
  // `style` prop: RN style `fontVariant` on native, CSS `font-variant-numeric`
  // on web. Caller-provided `style` still wins on conflicts.
  let mergedStyle = style;
  const variantStyle = getFontVariantStyle(fontVariant);
  if (variantStyle) {
    if (Array.isArray(style)) {
      mergedStyle = [variantStyle, ...style];
    } else {
      mergedStyle = style ? [variantStyle, style] : variantStyle;
    }
  }
  return (
    <StyledSizableText
      allowFontScaling={false}
      maxFontSizeMultiplier={1}
      size={size}
      style={mergedStyle}
      {...props}
    />
  );
}

export type ISizableTextProps = SizableTextProps;
