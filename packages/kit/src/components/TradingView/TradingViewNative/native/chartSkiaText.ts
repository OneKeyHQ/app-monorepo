// cspell:ignore Skia
import type { SkFont } from '@shopify/react-native-skia';

type ITradingViewNativeSkiaMeasurementFont = Pick<
  SkFont,
  'getGlyphIDs' | 'getGlyphWidths' | 'measureText'
>;

export function getTradingViewNativeSkiaDigitWidth(
  font: ITradingViewNativeSkiaMeasurementFont,
): number {
  'worklet';

  const digits = '0123456789';
  const advances = font.getGlyphWidths(font.getGlyphIDs(digits));
  let width = 0;
  for (let index = 0; index < digits.length; index += 1) {
    const bounds = font.measureText(digits[index]);
    width = Math.max(width, advances[index], bounds.x + bounds.width);
  }
  return width;
}

export function getTradingViewNativeSkiaPriceAxisLabelWidth(
  text: string,
  font: ITradingViewNativeSkiaMeasurementFont,
  digitWidth: number,
): number {
  'worklet';

  const bounds = font.measureText(text);
  const advances = font.getGlyphWidths(font.getGlyphIDs(text));
  let reservedAdvance = 0;
  let extraDigitWidth = 0;
  let glyphIndex = 0;
  for (const character of text) {
    const advance = advances[glyphIndex];
    const code = character.charCodeAt(0);
    const extra =
      code >= 48 && code <= 57 ? Math.max(digitWidth - advance, 0) : 0;
    reservedAdvance += advance + extra;
    extraDigitWidth += extra;
    glyphIndex += 1;
  }
  // Candidate labels use "8", but proportional digits can have wider advances or ink.
  return Math.max(
    reservedAdvance,
    bounds.x + bounds.width + extraDigitWidth,
    0,
  );
}

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
