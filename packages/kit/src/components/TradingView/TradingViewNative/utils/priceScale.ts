import type { ITradingViewNativePriceRange } from './chartViewport';
import type { ITradingViewNativePriceScaleMode } from '../types';

export interface ITradingViewNativeResolvedPriceRange extends ITradingViewNativePriceRange {
  mode: ITradingViewNativePriceScaleMode;
}

export function isTradingViewNativeLogPriceScaleAvailable(
  priceRange: ITradingViewNativePriceRange | null | undefined,
) {
  'worklet';

  return Boolean(
    priceRange && priceRange.minPrice > 0 && priceRange.maxPrice > 0,
  );
}

export function mergeTradingViewNativePriceRanges({
  additionalPriceRange,
  priceRange,
}: {
  additionalPriceRange?: ITradingViewNativePriceRange | null;
  priceRange?: ITradingViewNativePriceRange | null;
}): ITradingViewNativePriceRange | null {
  'worklet';

  const hasPriceRange =
    priceRange !== null &&
    priceRange !== undefined &&
    Number.isFinite(priceRange.minPrice) &&
    Number.isFinite(priceRange.maxPrice) &&
    priceRange.maxPrice >= priceRange.minPrice;
  const hasAdditionalPriceRange =
    additionalPriceRange !== null &&
    additionalPriceRange !== undefined &&
    Number.isFinite(additionalPriceRange.minPrice) &&
    Number.isFinite(additionalPriceRange.maxPrice) &&
    additionalPriceRange.maxPrice >= additionalPriceRange.minPrice;

  if (!hasPriceRange) {
    return hasAdditionalPriceRange ? additionalPriceRange : null;
  }
  if (!hasAdditionalPriceRange) {
    return priceRange;
  }
  return {
    maxPrice: Math.max(priceRange.maxPrice, additionalPriceRange.maxPrice),
    minPrice: Math.min(priceRange.minPrice, additionalPriceRange.minPrice),
  };
}

export function resolveTradingViewNativePriceRange({
  autoPriceRange,
  rangeScale,
  requestedMode,
}: {
  autoPriceRange: ITradingViewNativePriceRange;
  rangeScale: number;
  requestedMode: ITradingViewNativePriceScaleMode;
}): ITradingViewNativeResolvedPriceRange {
  'worklet';

  const normalizedRangeScale =
    Number.isFinite(rangeScale) && rangeScale > 0 ? rangeScale : 1;
  const mode =
    requestedMode === 'logarithmic' &&
    isTradingViewNativeLogPriceScaleAvailable(autoPriceRange)
      ? 'logarithmic'
      : 'linear';

  if (mode === 'logarithmic') {
    if (normalizedRangeScale === 1) {
      return { ...autoPriceRange, mode };
    }
    const logMinPrice = Math.log(autoPriceRange.minPrice);
    const logMaxPrice = Math.log(autoPriceRange.maxPrice);
    const logRange = logMaxPrice - logMinPrice;
    const logCenter = logMinPrice + logRange / 2;
    const scaledLogRange = logRange * normalizedRangeScale;
    const maxPrice = Math.exp(logCenter + scaledLogRange / 2);
    const minPrice = Math.exp(logCenter - scaledLogRange / 2);
    if (
      Number.isFinite(maxPrice) &&
      Number.isFinite(minPrice) &&
      minPrice > 0
    ) {
      return { maxPrice, minPrice, mode };
    }
    return { ...autoPriceRange, mode };
  }

  const range = autoPriceRange.maxPrice - autoPriceRange.minPrice;
  const center = autoPriceRange.minPrice + range / 2;
  const scaledRange = range * normalizedRangeScale;
  return {
    maxPrice: center + scaledRange / 2,
    minPrice: center - scaledRange / 2,
    mode,
  };
}

export function getTradingViewNativePriceAtProgress({
  maxPrice,
  minPrice,
  mode,
  progress,
}: ITradingViewNativePriceRange & {
  mode: ITradingViewNativePriceScaleMode;
  progress: number;
}) {
  'worklet';

  if (mode === 'logarithmic' && maxPrice > 0 && minPrice > 0) {
    const logMaxPrice = Math.log(maxPrice);
    return Math.exp(
      logMaxPrice - (logMaxPrice - Math.log(minPrice)) * progress,
    );
  }
  return maxPrice - (maxPrice - minPrice) * progress;
}

export function getTradingViewNativePriceProgress({
  maxPrice,
  minPrice,
  mode,
  price,
}: ITradingViewNativePriceRange & {
  mode: ITradingViewNativePriceScaleMode;
  price: number;
}): number | null {
  'worklet';

  if (!Number.isFinite(price)) {
    return null;
  }
  if (maxPrice === minPrice) {
    return 0.5;
  }
  if (mode === 'logarithmic' && maxPrice > 0 && minPrice > 0) {
    if (price <= 0) {
      return null;
    }
    const logMaxPrice = Math.log(maxPrice);
    return (logMaxPrice - Math.log(price)) / (logMaxPrice - Math.log(minPrice));
  }
  return (maxPrice - price) / (maxPrice - minPrice);
}
