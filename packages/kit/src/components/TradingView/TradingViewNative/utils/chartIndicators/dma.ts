// cspell:ignore DMA
import { subtractTradingViewNativeIndicatorValues } from './indicatorMath';
import { calculateTradingViewNativeSimpleMovingAverage } from './ma';

import type { ITradingViewNativeIndicatorValues } from './subIndicatorTypes';

export interface ITradingViewNativeDmaOptions {
  longPeriod?: number;
  movingAveragePeriod?: number;
  shortPeriod?: number;
}

export interface ITradingViewNativeDmaResult {
  dif: ITradingViewNativeIndicatorValues;
  movingAverage: ITradingViewNativeIndicatorValues;
}

/** Difference between a short and a long simple average, and its average. */
export function calculateTradingViewNativeDma(
  values: readonly (number | null | undefined)[],
  {
    longPeriod = 50,
    movingAveragePeriod = 10,
    shortPeriod = 10,
  }: ITradingViewNativeDmaOptions = {},
): ITradingViewNativeDmaResult {
  const dif = subtractTradingViewNativeIndicatorValues(
    calculateTradingViewNativeSimpleMovingAverage(values, shortPeriod),
    calculateTradingViewNativeSimpleMovingAverage(values, longPeriod),
  );
  return {
    dif,
    movingAverage: calculateTradingViewNativeSimpleMovingAverage(
      dif,
      movingAveragePeriod,
    ),
  };
}
