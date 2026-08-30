import {
  isTradingViewNativeFiniteValue,
  toTradingViewNativeFiniteValue,
} from './indicatorMath';
import { normalizeTradingViewNativeIndicatorPeriod } from './normalizePeriod';

import type { ITradingViewNativeIndicatorValues } from './subIndicatorTypes';

export function calculateTradingViewNativeWilderMovingAverage(
  values: readonly (number | null | undefined)[],
  period: number,
): ITradingViewNativeIndicatorValues {
  const normalizedPeriod = normalizeTradingViewNativeIndicatorPeriod(period);
  const result: ITradingViewNativeIndicatorValues = Array(values.length).fill(
    null,
  );
  const seedValues: number[] = [];
  let previousAverage: number | null = null;

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!isTradingViewNativeFiniteValue(value)) {
      seedValues.length = 0;
      previousAverage = null;
    } else if (previousAverage === null) {
      seedValues.push(value);
      if (seedValues.length === normalizedPeriod) {
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
        (value + previousAverage * (normalizedPeriod - 1)) / normalizedPeriod;
      previousAverage = toTradingViewNativeFiniteValue(nextAverage);
      result[index] = previousAverage;
      if (previousAverage === null) {
        seedValues.length = 0;
      }
    }
  }

  return result;
}
