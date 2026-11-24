// cspell:ignore WMA
import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';
import type { ITradingViewNativeIndicatorSettingsItem } from '@onekeyhq/shared/types/tradingViewNative';

import {
  buildTradingViewNativeIndicatorValues,
  isTradingViewNativeFiniteValue,
} from './indicatorMath';
import { buildTradingViewNativeMovingAverageSeries } from './movingAverage';
import { normalizeTradingViewNativeIndicatorPeriod } from './normalizePeriod';

import type { ITradingViewNativeIndicatorValues } from './subIndicatorTypes';

/** Linearly weighted average: the latest bar weighs `period`, the oldest 1. */
export function calculateTradingViewNativeWeightedMovingAverage(
  values: readonly (number | null | undefined)[],
  period: number,
): ITradingViewNativeIndicatorValues {
  const normalizedPeriod = normalizeTradingViewNativeIndicatorPeriod(period);
  const weightSum = (normalizedPeriod * (normalizedPeriod + 1)) / 2;
  return buildTradingViewNativeIndicatorValues(values.length, (endIndex) => {
    if (endIndex < normalizedPeriod - 1) {
      return null;
    }
    let sum = 0;
    for (let offset = 0; offset < normalizedPeriod; offset += 1) {
      const value = values[endIndex - normalizedPeriod + 1 + offset];
      if (!isTradingViewNativeFiniteValue(value)) {
        return null;
      }
      sum += value * (offset + 1);
    }
    return sum / weightSum;
  });
}

export function buildTradingViewNativeWmaSeries(
  points: readonly IMarketTokenKLineDataPoint[],
  settings?: ITradingViewNativeIndicatorSettingsItem,
) {
  return buildTradingViewNativeMovingAverageSeries({
    calculate: calculateTradingViewNativeWeightedMovingAverage,
    indicator: 'WMA',
    points,
    settings,
  });
}
