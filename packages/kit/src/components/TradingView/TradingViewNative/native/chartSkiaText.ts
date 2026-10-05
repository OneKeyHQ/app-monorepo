// cspell:ignore Skia
import type { SkFont } from '@shopify/react-native-skia';

export function getTradingViewNativeSkiaTextFont(
  text: string,
  font: SkFont,
  subscriptFont?: SkFont | null,
): SkFont {
  'worklet';

  // Keep localized labels on the legend font and use one font for compact values.
  if (subscriptFont && /[₀-₉]/.test(text) && /^[0-9₀-₉.+-]+$/.test(text)) {
    return subscriptFont;
  }
  return font;
}
