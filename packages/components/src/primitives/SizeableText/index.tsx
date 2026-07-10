import { SizableText as TamaguiSizableText } from '@tamagui/text';

import { type SizableTextProps } from '@onekeyhq/components/src/shared/tamagui';

import { TABULAR_NUMS, getFontVariantStyle } from '../../utils/tabularNums';

export const StyledSizableText = TamaguiSizableText;

export function SizableText({
  size = '$bodyMd',
  // App-wide default: tabular (equal-width) figures on ALL text, matching the
  // reference exchanges whose brand fonts ship tabular digits by default.
  // Only digit glyph widths change — letters are unaffected — so prose is
  // safe. Opt out per text with `fontVariant={PROPORTIONAL_NUMS}`.
  fontVariant = TABULAR_NUMS,
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
