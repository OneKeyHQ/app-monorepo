import type { ILightweightChartPriceFormatterType } from '../types';

export function resolveSerializablePriceFormatterType({
  seriesType,
  priceFormatter,
}: {
  seriesType: 'area' | 'baseline' | 'dotted-area';
  priceFormatter?: (price: number) => string;
}): ILightweightChartPriceFormatterType {
  if (seriesType === 'dotted-area') {
    return 'number';
  }

  if (!priceFormatter) {
    return 'percent';
  }

  try {
    const sampleText = [1.23, -1.23, 1234]
      .map((value) => priceFormatter(value))
      .join(' ');

    if (sampleText.includes('%')) {
      return 'percent';
    }

    if (/[$€£¥]|USD|US\$/i.test(sampleText)) {
      return 'usd';
    }
  } catch {
    // Fall through to the conservative default when the formatter is not safe to sample.
  }

  return 'percent';
}

export function resolveSerializablePriceFormatterTickStep({
  seriesType,
  priceFormatterTickStep,
}: {
  seriesType: 'area' | 'baseline' | 'dotted-area';
  priceFormatterTickStep?: number;
}): number | undefined {
  if (seriesType !== 'dotted-area') {
    return undefined;
  }

  return priceFormatterTickStep;
}
