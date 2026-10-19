import { createContext, useContext } from 'react';

import { SizableText as TamaguiSizableText } from '@tamagui/text';
import { PixelRatio, StyleSheet } from 'react-native';

import { type SizableTextProps } from '@onekeyhq/components/src/shared/tamagui';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { getFontToken } from '../../utils/getFontSize';
import { TABULAR_NUMS, getFontVariantStyle } from '../../utils/tabularNums';

// Nested text contributes its own line height to the same native paragraph.
const SingleLineAutoSizeContext = createContext(false);

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
  const inheritsAutoSize = useContext(SingleLineAutoSizeContext);
  const isSingleLineAutoSize =
    platformEnv.isNativeIOS &&
    (inheritsAutoSize ||
      (props.adjustsFontSizeToFit && props.numberOfLines === 1));
  let mergedStyle = style;
  if (isSingleLineAutoSize) {
    const flattenedStyle = StyleSheet.flatten(style);
    const fontToken = getFontToken(size);
    const lineHeight =
      (typeof flattenedStyle === 'object'
        ? flattenedStyle?.lineHeight
        : undefined) ??
      props.lineHeight ??
      (typeof fontToken === 'object' ? fontToken?.lineHeight : undefined);
    if (typeof lineHeight === 'number' && lineHeight > 0) {
      const scale = PixelRatio.get();
      // RN rounds measured heights up to whole pixels. Leave half a pixel below
      // that height so float rounding cannot trigger unnecessary font shrinking.
      mergedStyle = {
        ...(typeof flattenedStyle === 'object' ? flattenedStyle : {}),
        lineHeight: (Math.ceil(lineHeight * scale) - 0.5) / scale,
      };
    }
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
  const text = (
    <StyledSizableText
      allowFontScaling={false}
      maxFontSizeMultiplier={1}
      size={size}
      style={mergedStyle}
      {...props}
    />
  );
  return isSingleLineAutoSize && !inheritsAutoSize ? (
    <SingleLineAutoSizeContext.Provider value>
      {text}
    </SingleLineAutoSizeContext.Provider>
  ) : (
    text
  );
}

export type ISizableTextProps = SizableTextProps;
