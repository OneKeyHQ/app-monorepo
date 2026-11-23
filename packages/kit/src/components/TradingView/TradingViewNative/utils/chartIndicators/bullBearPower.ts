import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

import { calculateTradingViewNativeExponentialMovingAverage } from './ema';
import {
  buildTradingViewNativeIndicatorValues,
  getTradingViewNativePointValues,
  isTradingViewNativeFiniteValue,
} from './indicatorMath';

import type { ITradingViewNativeIndicatorValues } from './subIndicatorTypes';

const DEFAULT_BULL_BEAR_POWER_PERIOD = 13;

/**
 * Bull bear power: bull power (high minus the exponential average of the
 * close) plus bear power (low minus the same average).
 */
export function calculateTradingViewNativeBullBearPower(
  points: readonly IMarketTokenKLineDataPoint[],
  period = DEFAULT_BULL_BEAR_POWER_PERIOD,
): ITradingViewNativeIndicatorValues {
  const averages = calculateTradingViewNativeExponentialMovingAverage(
    getTradingViewNativePointValues(points, 'c'),
    period,
  );
  return buildTradingViewNativeIndicatorValues(points.length, (index) => {
    const point = points[index];
    const average = averages[index];
    return point &&
      isTradingViewNativeFiniteValue(point.h) &&
      isTradingViewNativeFiniteValue(point.l) &&
      isTradingViewNativeFiniteValue(average)
      ? point.h + point.l - 2 * average
      : null;
  });
}
