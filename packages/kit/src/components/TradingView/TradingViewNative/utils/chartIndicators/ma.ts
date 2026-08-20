import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

import {
  isTradingViewNativeFiniteValue,
  toTradingViewNativeFiniteValue,
} from './indicatorMath';
import { buildTradingViewNativeMovingAverageSeries } from './movingAverage';
import { normalizeTradingViewNativeIndicatorPeriod } from './normalizePeriod';

export function calculateTradingViewNativeSimpleMovingAverage(
  values: readonly (number | null | undefined)[],
  period: number,
): Array<number | null> {
  const normalizedPeriod = normalizeTradingViewNativeIndicatorPeriod(period);
  const result = Array<number | null>(values.length).fill(null);
  let sum = 0;
  let validValueCount = 0;

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (isTradingViewNativeFiniteValue(value)) {
      sum += value;
      validValueCount += 1;
    }

    const expiredIndex = index - normalizedPeriod;
    if (expiredIndex >= 0) {
      const expiredValue = values[expiredIndex];
      if (isTradingViewNativeFiniteValue(expiredValue)) {
        sum -= expiredValue;
        validValueCount -= 1;
      }
    }

    if (index >= normalizedPeriod - 1 && validValueCount === normalizedPeriod) {
      result[index] = toTradingViewNativeFiniteValue(sum / normalizedPeriod);
    }
  }

  return result;
}

export function buildTradingViewNativeMaSeries(
  points: readonly IMarketTokenKLineDataPoint[],
) {
  return buildTradingViewNativeMovingAverageSeries({
    calculate: calculateTradingViewNativeSimpleMovingAverage,
    indicator: 'MA',
    points,
  });
}
