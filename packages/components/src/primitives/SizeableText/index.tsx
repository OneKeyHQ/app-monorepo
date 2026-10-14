import { SizableText as TamaguiSizableText } from '@tamagui/text';
import { StyleSheet } from 'react-native';

import { type SizableTextProps } from '@onekeyhq/components/src/shared/tamagui';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { getFontToken } from '../../utils/getFontSize';
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
  let mergedStyle = style;
  const autoSizeProps: Pick<SizableTextProps, 'lineHeight' | 'minHeight'> = {};
  if (
    platformEnv.isNativeIOS &&
    props.adjustsFontSizeToFit &&
    props.numberOfLines === 1
  ) {
    const flattenedStyle = StyleSheet.flatten(style);
    const { lineHeight, ...naturalLineHeightStyle } =
      typeof flattenedStyle === 'object' ? flattenedStyle : {};
    const fontToken = getFontToken(size);
    const defaultLineHeight =
      typeof fontToken === 'object' ? fontToken?.lineHeight : undefined;
    const requestedLineHeight = lineHeight ?? props.lineHeight;
    const originalLineHeight =
      typeof requestedLineHeight === 'number'
        ? requestedLineHeight
        : defaultLineHeight;
    // Preserve the cell height without a fixed text line height: iOS can otherwise
    // shrink to its minimum font size when pixel rounding makes the cell shorter.
    autoSizeProps.lineHeight = 'unset';
    autoSizeProps.minHeight =
      naturalLineHeightStyle.minHeight ?? props.minHeight ?? originalLineHeight;
    mergedStyle = naturalLineHeightStyle;
  }
  // Tamagui silently drops the RN `fontVariant` prop, so numeric variants
  // (tabular-nums etc.) never reach the renderer — re-route it through the
  // `style` prop: RN style `fontVariant` on native, CSS `font-variant-numeric`
  // on web. Caller-provided `style` still wins on conflicts.
  const variantStyle = getFontVariantStyle(fontVariant);
  if (variantStyle) {
    if (Array.isArray(mergedStyle)) {
      mergedStyle = [variantStyle, ...mergedStyle];
    } else {
      mergedStyle = mergedStyle ? [variantStyle, mergedStyle] : variantStyle;
    }
  }
  return (
    <StyledSizableText
      allowFontScaling={false}
      maxFontSizeMultiplier={1}
      size={size}
      style={mergedStyle}
      {...props}
      {...autoSizeProps}
    />
  );
}

export type ISizableTextProps = SizableTextProps;
