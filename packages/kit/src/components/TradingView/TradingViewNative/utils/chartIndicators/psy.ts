import {
  buildTradingViewNativeIndicatorValues,
  calculateTradingViewNativeRollingSum,
  isTradingViewNativeFiniteValue,
} from './indicatorMath';
import { calculateTradingViewNativeSimpleMovingAverage } from './ma';
import { normalizeTradingViewNativeIndicatorPeriod } from './normalizePeriod';

import type { ITradingViewNativeIndicatorValues } from './subIndicatorTypes';

export interface ITradingViewNativePsyOptions {
  movingAveragePeriod?: number;
  period?: number;
}

export interface ITradingViewNativePsyResult {
  movingAverage: ITradingViewNativeIndicatorValues;
  psy: ITradingViewNativeIndicatorValues;
}

/**
 * Psychological line: the percentage of the latest `period` bars that closed
 * above the bar before them.
 */
export function calculateTradingViewNativePsychologicalLine(
  values: readonly (number | null | undefined)[],
  { movingAveragePeriod = 6, period = 12 }: ITradingViewNativePsyOptions = {},
): ITradingViewNativePsyResult {
  const normalizedPeriod = normalizeTradingViewNativeIndicatorPeriod(period);
  const risingBarCounts = calculateTradingViewNativeRollingSum(
    buildTradingViewNativeIndicatorValues(values.length, (index) => {
      const value = values[index];
      const previousValue = values[index - 1];
      return isTradingViewNativeFiniteValue(value) &&
        isTradingViewNativeFiniteValue(previousValue)
        ? Number(value > previousValue)
        : null;
    }),
    normalizedPeriod,
  );
  const psy = buildTradingViewNativeIndicatorValues(values.length, (index) => {
    const risingBarCount = risingBarCounts[index];
    return isTradingViewNativeFiniteValue(risingBarCount)
      ? (100 * risingBarCount) / normalizedPeriod
      : null;
  });
  return {
    movingAverage: calculateTradingViewNativeSimpleMovingAverage(
      psy,
      movingAveragePeriod,
    ),
    psy,
  };
}
