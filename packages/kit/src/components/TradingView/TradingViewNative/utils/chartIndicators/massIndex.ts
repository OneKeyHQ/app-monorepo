import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

import { calculateTradingViewNativeExponentialMovingAverage } from './ema';
import {
  buildTradingViewNativeIndicatorValues,
  calculateTradingViewNativeRollingSum,
  isTradingViewNativeFiniteValue,
} from './indicatorMath';

import type { ITradingViewNativeIndicatorValues } from './subIndicatorTypes';

const MASS_INDEX_SMOOTHING_PERIOD = 9;
const DEFAULT_MASS_INDEX_PERIOD = 10;

/**
 * Mass index: the high-low range smoothed by a 9-bar exponential average,
 * divided by that average smoothed again, summed over `period` bars.
 */
export function calculateTradingViewNativeMassIndex(
  points: readonly IMarketTokenKLineDataPoint[],
  period = DEFAULT_MASS_INDEX_PERIOD,
): ITradingViewNativeIndicatorValues {
  const singleAverages = calculateTradingViewNativeExponentialMovingAverage(
    buildTradingViewNativeIndicatorValues(points.length, (index) => {
      const point = points[index];
      return point &&
        isTradingViewNativeFiniteValue(point.h) &&
        isTradingViewNativeFiniteValue(point.l)
        ? point.h - point.l
        : null;
    }),
    MASS_INDEX_SMOOTHING_PERIOD,
  );
  const doubleAverages = calculateTradingViewNativeExponentialMovingAverage(
    singleAverages,
    MASS_INDEX_SMOOTHING_PERIOD,
  );
  return calculateTradingViewNativeRollingSum(
    buildTradingViewNativeIndicatorValues(points.length, (index) => {
      const singleAverage = singleAverages[index];
      const doubleAverage = doubleAverages[index];
      return isTradingViewNativeFiniteValue(singleAverage) &&
        isTradingViewNativeFiniteValue(doubleAverage) &&
        doubleAverage !== 0
        ? singleAverage / doubleAverage
        : null;
    }),
    period,
  );
}
