import type { CSSProperties } from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { TextStyle } from 'react-native';

/**
 * Tabular (equal-width) figures — OPT-IN, for dense numeric data only.
 *
 * Apply as `fontVariant={TABULAR_NUMS}` (or a `fontVariant` StyleSheet entry on
 * raw React Native `<Text>`) to numbers that are **small, sit in a column, and
 * tick**: market/perps list columns, order books, trading tables, ticker strips.
 * Every digit then shares one advance width, so columns stay aligned and a value
 * doesn't reflow as it updates.
 *
 * Do NOT apply it to anything a human reads as words. Text is proportional by
 * default and that is almost always right:
 *  - names & identifiers (account "A1787", wallet "OneKey Pro2-1-6")
 *  - addresses / hashes (mixed hex — tabular equalizes only the digits, leaving
 *    the letters proportional, which reads worse than either)
 *  - prose and marketing copy
 *  - large hero numbers (a single big number has no column to align with, and
 *    Roobert's tabular `1` is nearly 2x wider and grows a foot serif)
 *  - amount input fields
 */
export const TABULAR_NUMS: ['tabular-nums'] = ['tabular-nums'];

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

// Hoisted so the common opt-in path allocates nothing and stays
// reference-stable. Both platforms carry it inline: there is no global rule to
// inherit from any more.
const TABULAR_NUMS_STYLE = buildFontVariantStyle(TABULAR_NUMS);

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
