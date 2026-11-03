// cspell:ignore Skia
import type { SkFont } from '@shopify/react-native-skia';

type ITradingViewNativeSkiaMeasurementFont = Pick<
  SkFont,
  'getGlyphIDs' | 'getGlyphWidths' | 'measureText'
>;

export interface ITradingViewNativeSkiaDigitMetrics {
  // Widest digit advance, reserved for every digit slot.
  advance: number;
  // Rightmost digit ink, which can only overflow from the last slot.
  inkRight: number;
}

export function getTradingViewNativeSkiaDigitMetrics(
  font: ITradingViewNativeSkiaMeasurementFont,
): ITradingViewNativeSkiaDigitMetrics {
  'worklet';

  const digits = '0123456789';
  const advances = font.getGlyphWidths(font.getGlyphIDs(digits));
  let advance = 0;
  let inkRight = 0;
  for (let index = 0; index < digits.length; index += 1) {
    const bounds = font.measureText(digits[index]);
    advance = Math.max(advance, advances[index]);
    inkRight = Math.max(inkRight, bounds.x + bounds.width);
  }
  return { advance, inkRight };
}

export function getTradingViewNativeSkiaDigitWidth(
  font: ITradingViewNativeSkiaMeasurementFont,
): number {
  'worklet';

  const { advance, inkRight } = getTradingViewNativeSkiaDigitMetrics(font);
  return Math.max(advance, inkRight);
}

export function getTradingViewNativeSkiaPriceAxisLabelWidth(
  text: string,
  font: ITradingViewNativeSkiaMeasurementFont,
  // A single width reserves it for every digit slot, as LightweightChart does.
  digitWidthOrMetrics: number | ITradingViewNativeSkiaDigitMetrics,
): number {
  'worklet';

  const digitMetrics =
    typeof digitWidthOrMetrics === 'number'
      ? { advance: digitWidthOrMetrics, inkRight: digitWidthOrMetrics }
      : digitWidthOrMetrics;
  const bounds = font.measureText(text);
  const advances = font.getGlyphWidths(font.getGlyphIDs(text));
  let reservedAdvance = 0;
  let extraDigitWidth = 0;
  let lastDigitInkOverflow = 0;
  let glyphIndex = 0;
  for (const character of text) {
    const advance = advances[glyphIndex];
    const code = character.charCodeAt(0);
    const isDigit = code >= 48 && code <= 57;
    const extra = isDigit ? Math.max(digitMetrics.advance - advance, 0) : 0;
    reservedAdvance += advance + extra;
    extraDigitWidth += extra;
    // Earlier ink overlaps the next slot. Skia also rounds single-glyph bounds
    // out to whole points, so adding this per digit over-reserves the axis.
    lastDigitInkOverflow = isDigit
      ? Math.max(digitMetrics.inkRight - (advance + extra), 0)
      : 0;
    glyphIndex += 1;
  }
  // Candidate labels use "8", but proportional digits can have wider advances or ink.
  return Math.max(
    reservedAdvance + lastDigitInkOverflow,
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
