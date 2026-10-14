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
  const useNaturalLineHeight =
    platformEnv.isNativeIOS &&
    props.adjustsFontSizeToFit &&
    props.numberOfLines === 1;
  const fontToken = useNaturalLineHeight ? getFontToken(size) : undefined;
  const flattenedStyleValue = useNaturalLineHeight
    ? StyleSheet.flatten(style)
    : undefined;
  const flattenedStyle =
    typeof flattenedStyleValue === 'object' ? flattenedStyleValue : undefined;
  const requestedLineHeight = flattenedStyle?.lineHeight ?? props.lineHeight;
  let originalLineHeight =
    typeof fontToken === 'object' ? fontToken?.lineHeight : undefined;
  if (typeof requestedLineHeight === 'number') {
    originalLineHeight = requestedLineHeight;
  }
  // Tamagui silently drops the RN `fontVariant` prop, so numeric variants
  // (tabular-nums etc.) never reach the renderer — re-route it through the
  // `style` prop: RN style `fontVariant` on native, CSS `font-variant-numeric`
  // on web. Caller-provided `style` still wins on conflicts.
  let mergedStyle = style;
  if (flattenedStyle) {
    const { lineHeight: _lineHeight, ...naturalLineHeightStyle } =
      flattenedStyle;
    mergedStyle = naturalLineHeightStyle;
  }
  const variantStyle = getFontVariantStyle(fontVariant);
  if (variantStyle) {
    if (Array.isArray(mergedStyle)) {
      mergedStyle = [variantStyle, ...mergedStyle];
    } else {
      mergedStyle = mergedStyle ? [variantStyle, mergedStyle] : variantStyle;
    }
  }
  // Preserve the cell height without a fixed text line height: iOS can otherwise
  // shrink to its minimum font size when pixel rounding makes the cell shorter.
  const autoSizeProps = useNaturalLineHeight
    ? {
        lineHeight: 'unset' as const,
        minHeight:
          flattenedStyle?.minHeight ?? props.minHeight ?? originalLineHeight,
      }
    : {};
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
