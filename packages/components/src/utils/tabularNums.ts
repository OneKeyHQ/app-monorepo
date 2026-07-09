import type { CSSProperties } from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { TextStyle } from 'react-native';

/**
 * Tabular (equal-width) figures for numeric text.
 *
 * Apply as `fontVariant={TABULAR_NUMS}` on `SizableText` / `NumberSizeableText`
 * (and any Tamagui text) so every digit shares one advance width — columns of
 * numbers stay aligned and a value doesn't reflow left/right as it ticks.
 *
 * Prefer this over switching to a monospace font family (`$monoRegular` /
 * `$monoMedium`): a mono font also mono-widths letters (typewriter look),
 * whereas tabular-nums keeps the app font's natural proportional letters and
 * only equalizes digits. The app font (Roobert) ships the `tnum` OpenType
 * feature, so this renders correctly on iOS, Android and web.
 *
 * Monospace is still the right choice for addresses / hashes / mnemonics /
 * codes, where character (not just digit) alignment matters — do NOT replace
 * those with tabular-nums.
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
