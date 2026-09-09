import { formatTradingViewNativePriceTick } from '../chartLayout';

import type {
  ITradingViewNativeIndicatorPriceRange,
  ITradingViewNativeIndicatorSeries,
} from './types';

export function getTradingViewNativeIndicatorPriceRange({
  endIndex,
  series,
  startIndex,
}: {
  endIndex: number;
  series: readonly ITradingViewNativeIndicatorSeries[];
  startIndex: number;
}): ITradingViewNativeIndicatorPriceRange | null {
  'worklet';

  let minPrice = Number.POSITIVE_INFINITY;
  let maxPrice = Number.NEGATIVE_INFINITY;

  for (const indicatorSeries of series) {
    const clampedStartIndex = Math.min(
      Math.max(Math.floor(startIndex), 0),
      indicatorSeries.values.length,
    );
    const clampedEndIndex = Math.min(
      Math.max(Math.floor(endIndex), clampedStartIndex),
      indicatorSeries.values.length,
    );
    for (let index = clampedStartIndex; index < clampedEndIndex; index += 1) {
      const value = indicatorSeries.values[index];
      if (value !== null && Number.isFinite(value)) {
        minPrice = Math.min(minPrice, value);
        maxPrice = Math.max(maxPrice, value);
      }
    }
  }

  return Number.isFinite(minPrice) && Number.isFinite(maxPrice)
    ? { maxPrice, minPrice }
    : null;
}

export function getTradingViewNativeIndicatorPriceAxisLabel(
  series: readonly ITradingViewNativeIndicatorSeries[],
) {
  const endIndex = series.reduce(
    (maxLength, indicatorSeries) =>
      Math.max(maxLength, indicatorSeries.values.length),
    0,
  );
  const priceRange = getTradingViewNativeIndicatorPriceRange({
    endIndex,
    series,
    startIndex: 0,
  });
  if (!priceRange) {
    return '';
  }

  const minLabel = formatTradingViewNativePriceTick(priceRange.minPrice);
  const maxLabel = formatTradingViewNativePriceTick(priceRange.maxPrice);
  return minLabel.length > maxLabel.length ? minLabel : maxLabel;
}
