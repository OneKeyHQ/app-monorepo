import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

import { buildTradingViewNativeMovingAverageSeries } from './movingAverage';
import { normalizeTradingViewNativeIndicatorPeriod } from './normalizePeriod';

export function calculateTradingViewNativeExponentialMovingAverage(
  values: readonly number[],
  period: number,
): Array<number | null> {
  const normalizedPeriod = normalizeTradingViewNativeIndicatorPeriod(period);
  const multiplier = 2 / (normalizedPeriod + 1);
  const result = Array<number | null>(values.length).fill(null);
  const seedValues: number[] = [];
  let previousAverage: number | null = null;

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!Number.isFinite(value)) {
      seedValues.length = 0;
      previousAverage = null;
    } else if (previousAverage === null) {
      seedValues.push(value);
      if (seedValues.length >= normalizedPeriod) {
        previousAverage =
          seedValues.reduce((sum, seedValue) => sum + seedValue, 0) /
          normalizedPeriod;
        result[index] = previousAverage;
      }
    } else {
      previousAverage =
        (value - previousAverage) * multiplier + previousAverage;
      result[index] = previousAverage;
    }
  }

  return result;
}

export function buildTradingViewNativeEmaSeries(
  points: readonly IMarketTokenKLineDataPoint[],
) {
  return buildTradingViewNativeMovingAverageSeries({
    calculate: calculateTradingViewNativeExponentialMovingAverage,
    indicator: 'EMA',
    points,
  });
}
