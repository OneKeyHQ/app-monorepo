import { calculateTradingViewNativeExponentialMovingAverage } from './ema';
import {
  buildTradingViewNativeIndicatorValues,
  calculateTradingViewNativeRollingStandardDeviation,
  isTradingViewNativeFiniteValue,
} from './indicatorMath';
import { calculateTradingViewNativeSimpleMovingAverage } from './ma';

import type { ITradingViewNativeIndicatorValues } from './subIndicatorTypes';

const RELATIVE_VOLATILITY_SMOOTHING_PERIOD = 14;

export interface ITradingViewNativeRelativeVolatilityIndexOptions {
  period?: number;
  signalPeriod?: number;
}

export interface ITradingViewNativeRelativeVolatilityIndexResult {
  rvi: ITradingViewNativeIndicatorValues;
  signal: ITradingViewNativeIndicatorValues;
}

/**
 * Relative volatility index: the standard deviation of rising bars as a
 * percentage of the standard deviation of all bars, each side smoothed by a
 * 14-bar exponential average. The signal is the simple average of the index.
 */
export function calculateTradingViewNativeRelativeVolatilityIndex(
  values: readonly (number | null | undefined)[],
  {
    period = 10,
    signalPeriod = 14,
  }: ITradingViewNativeRelativeVolatilityIndexOptions = {},
): ITradingViewNativeRelativeVolatilityIndexResult {
  const deviations = calculateTradingViewNativeRollingStandardDeviation(
    values,
    period,
  );
  const getSmoothedSide = (side: 'down' | 'up') =>
    calculateTradingViewNativeExponentialMovingAverage(
      buildTradingViewNativeIndicatorValues(values.length, (index) => {
        const value = values[index];
        const previousValue = values[index - 1];
        const deviation = deviations[index];
        if (
          !isTradingViewNativeFiniteValue(value) ||
          !isTradingViewNativeFiniteValue(previousValue) ||
          !isTradingViewNativeFiniteValue(deviation)
        ) {
          return null;
        }
        return value > previousValue === (side === 'up') ? deviation : 0;
      }),
      RELATIVE_VOLATILITY_SMOOTHING_PERIOD,
    );
  const upSide = getSmoothedSide('up');
  const downSide = getSmoothedSide('down');
  const rvi = buildTradingViewNativeIndicatorValues(values.length, (index) => {
    const up = upSide[index];
    const down = downSide[index];
    return isTradingViewNativeFiniteValue(up) &&
      isTradingViewNativeFiniteValue(down) &&
      up + down !== 0
      ? (100 * up) / (up + down)
      : null;
  });
  return {
    rvi,
    signal: calculateTradingViewNativeSimpleMovingAverage(rvi, signalPeriod),
  };
}
