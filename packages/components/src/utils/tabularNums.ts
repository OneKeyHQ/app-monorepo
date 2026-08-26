import type { CSSProperties } from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { TextStyle } from 'react-native';

/**
 * Tabular (equal-width) figures for numeric text.
 *
 * `SizableText` applies this by DEFAULT app-wide, and web mirrors it with an
 * injected `body { font-variant-numeric: tabular-nums }` rule, so most text
 * needs nothing. Reach for the constant directly only for text that bypasses
 * the `SizableText` wrapper — raw React Native `<Text>` / `StyleSheet.create`,
 * or `Badge.Text` — via `getFontVariantStyle(TABULAR_NUMS)`.
 *
 * Every digit shares one advance width, so number columns stay aligned and a
 * value doesn't reflow as it ticks. Unlike a monospace family (`$monoRegular`),
 * only digits are equalized — letters keep Roobert's natural proportional
 * widths. Roobert ships the `tnum` OpenType feature, so this works on iOS,
 * Android and web.
 *
 * Monospace is still the right choice for addresses / hashes / mnemonics /
 * codes, where character (not just digit) alignment matters — do NOT replace
 * those with tabular-nums.
 */
export const TABULAR_NUMS: ['tabular-nums'] = ['tabular-nums'];

/**
 * Escape hatch from the app-wide tabular default (`SizableText` defaults
 * `fontVariant` to TABULAR_NUMS): pass `fontVariant={PROPORTIONAL_NUMS}` to
 * restore the font's natural proportional figures for a specific text.
 */
export const PROPORTIONAL_NUMS: ['proportional-nums'] = ['proportional-nums'];

type IFontVariantStyle = CSSProperties | TextStyle;

function buildFontVariantStyle(
  fontVariant: NonNullable<TextStyle['fontVariant']>,
): IFontVariantStyle {
  if (platformEnv.isNative) {
    return Object.freeze({ fontVariant });
  }
  const style: CSSProperties = {};
  const numericVariants = fontVariant.filter((v) => v.endsWith('-nums'));
  if (numericVariants.length > 0) {
    style.fontVariantNumeric = numericVariants.join(' ');
  }
  if (fontVariant.includes('small-caps')) {
    style.fontVariantCaps = 'small-caps';
  }
  return Object.freeze(style);
}

// Web applies tabular figures globally via the `body` rule in web-fonts.css,
// so the DEFAULT variant needs no inline style — leaving it undefined avoids a
// redundant style attr on every text node and keeps `style` reference-stable.
// Native has no CSS inheritance, so it must carry the variant inline.
const TABULAR_NUMS_STYLE: IFontVariantStyle | undefined = platformEnv.isNative
  ? buildFontVariantStyle(TABULAR_NUMS)
  : undefined;

const fontVariantStyleCache = new WeakMap<
  NonNullable<TextStyle['fontVariant']>,
  IFontVariantStyle
>();

/**
 * Translate the RN `fontVariant` array into a platform-appropriate style
 * object (RN style `fontVariant` on native, CSS `font-variant-numeric` /
 * `font-variant-caps` on web), since Tamagui silently drops the raw
 * `fontVariant` prop.
 *
 * Results are cached per array reference (with a hoisted fast path for
 * `TABULAR_NUMS`), so the returned object is reference-stable across renders.
 */
export function getFontVariantStyle(
  // Tamagui widens the prop with an extra 'unset' string literal.
  fontVariant: TextStyle['fontVariant'] | 'unset',
): IFontVariantStyle | undefined {
  if (fontVariant === TABULAR_NUMS) {
    return TABULAR_NUMS_STYLE;
  }
  if (!Array.isArray(fontVariant) || fontVariant.length === 0) {
    return undefined;
  }
  let cached = fontVariantStyleCache.get(fontVariant);
  if (!cached) {
    cached = buildFontVariantStyle(fontVariant);
    fontVariantStyleCache.set(fontVariant, cached);
  }
  return cached;
}
