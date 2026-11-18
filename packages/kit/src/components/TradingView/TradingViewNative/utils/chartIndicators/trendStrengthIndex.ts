import {
  buildTradingViewNativeIndicatorValues,
  isTradingViewNativeFiniteValue,
} from './indicatorMath';
import { normalizeTradingViewNativeIndicatorPeriod } from './normalizePeriod';

import type { ITradingViewNativeIndicatorValues } from './subIndicatorTypes';

const DEFAULT_TREND_STRENGTH_PERIOD = 14;

/**
 * Trend strength index: the correlation between the values and time over a
 * full window, from -1 (steady fall) to 1 (steady rise). A flat window has no
 * correlation.
 */
export function calculateTradingViewNativeTrendStrengthIndex(
  values: readonly (number | null | undefined)[],
  period = DEFAULT_TREND_STRENGTH_PERIOD,
): ITradingViewNativeIndicatorValues {
  const normalizedPeriod = normalizeTradingViewNativeIndicatorPeriod(period);
  const averageOffset = (normalizedPeriod - 1) / 2;
  let offsetVariance = 0;
  for (let offset = 0; offset < normalizedPeriod; offset += 1) {
    offsetVariance += (offset - averageOffset) ** 2;
  }
  return buildTradingViewNativeIndicatorValues(values.length, (endIndex) => {
    if (endIndex < normalizedPeriod - 1) {
      return null;
    }
    const startIndex = endIndex - normalizedPeriod + 1;
    let sum = 0;
    for (let offset = 0; offset < normalizedPeriod; offset += 1) {
      const value = values[startIndex + offset];
      if (!isTradingViewNativeFiniteValue(value)) {
        return null;
      }
      sum += value;
    }
    const average = sum / normalizedPeriod;
    let covariance = 0;
    let valueVariance = 0;
    for (let offset = 0; offset < normalizedPeriod; offset += 1) {
      const deviation = (values[startIndex + offset] ?? average) - average;
      covariance += (offset - averageOffset) * deviation;
      valueVariance += deviation * deviation;
    }
    const scale = Math.sqrt(offsetVariance * valueVariance);
    return scale === 0 ? null : covariance / scale;
  });
}
