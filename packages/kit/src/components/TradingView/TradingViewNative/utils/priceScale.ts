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

export function panTradingViewNativePriceRange({
  priceRange,
  rangeScale,
  mode,
  chartHeight,
  translationY,
}: {
  priceRange: ITradingViewNativePriceRange;
  rangeScale: number;
  mode: ITradingViewNativePriceScaleMode;
  chartHeight: number;
  translationY: number;
}): ITradingViewNativePriceRange {
  'worklet';

  if (chartHeight <= 0 || !Number.isFinite(translationY)) return priceRange;
  const progress = (translationY * rangeScale) / chartHeight;
  let { minPrice, maxPrice } = priceRange;
  const logarithmic = mode === 'logarithmic' && minPrice > 0 && maxPrice > 0;
  if (minPrice === maxPrice) {
    // Give flat series a movable range without changing their centered position.
    if (logarithmic) {
      minPrice /= 1.01;
      maxPrice *= 1.01;
    } else {
      const padding = Math.abs(minPrice) * 0.01 || 1;
      minPrice -= padding;
      maxPrice += padding;
    }
  }
  const shift = logarithmic
    ? (Math.log(maxPrice) - Math.log(minPrice)) * progress
    : (maxPrice - minPrice) * progress;
  const nextMin = logarithmic
    ? Math.exp(Math.log(minPrice) + shift)
    : minPrice + shift;
  const nextMax = logarithmic
    ? Math.exp(Math.log(maxPrice) + shift)
    : maxPrice + shift;
  return Number.isFinite(nextMin) &&
    Number.isFinite(nextMax) &&
    (!logarithmic || nextMin > 0)
    ? { minPrice: nextMin, maxPrice: nextMax }
    : priceRange;
}
