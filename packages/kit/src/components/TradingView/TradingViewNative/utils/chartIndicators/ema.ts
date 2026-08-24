import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';
import type { ITradingViewNativeIndicatorSettingsItem } from '@onekeyhq/shared/types/tradingViewNative';

import {
  isTradingViewNativeFiniteValue,
  toTradingViewNativeFiniteValue,
} from './indicatorMath';
import { buildTradingViewNativeMovingAverageSeries } from './movingAverage';
import { normalizeTradingViewNativeIndicatorPeriod } from './normalizePeriod';

export function calculateTradingViewNativeExponentialMovingAverage(
  values: readonly (number | null | undefined)[],
  period: number,
): Array<number | null> {
  const normalizedPeriod = normalizeTradingViewNativeIndicatorPeriod(period);
  const multiplier = 2 / (normalizedPeriod + 1);
  const result = Array<number | null>(values.length).fill(null);
  const seedValues: number[] = [];
  let previousAverage: number | null = null;

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!isTradingViewNativeFiniteValue(value)) {
      seedValues.length = 0;
      previousAverage = null;
    } else if (previousAverage === null) {
      seedValues.push(value);
      if (seedValues.length >= normalizedPeriod) {
        const seedAverage =
          seedValues.reduce((sum, seedValue) => sum + seedValue, 0) /
          normalizedPeriod;
        previousAverage = toTradingViewNativeFiniteValue(seedAverage);
        result[index] = previousAverage;
        if (previousAverage === null) {
          seedValues.length = 0;
        }
      }
    } else {
      const nextAverage =
        (value - previousAverage) * multiplier + previousAverage;
      previousAverage = toTradingViewNativeFiniteValue(nextAverage);
      result[index] = previousAverage;
      if (previousAverage === null) {
        seedValues.length = 0;
      }
    }
  }

  return result;
}

export function buildTradingViewNativeEmaSeries(
  points: readonly IMarketTokenKLineDataPoint[],
  settings?: ITradingViewNativeIndicatorSettingsItem,
) {
  return buildTradingViewNativeMovingAverageSeries({
    calculate: calculateTradingViewNativeExponentialMovingAverage,
    indicator: 'EMA',
    points,
    settings,
  });
}
