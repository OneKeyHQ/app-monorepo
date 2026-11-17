// cspell:ignore NVI
import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

import {
  buildTradingViewNativeIndicatorValues,
  isTradingViewNativeFiniteValue,
} from './indicatorMath';
import { normalizeTradingViewNativeIndicatorPeriod } from './normalizePeriod';

import type { ITradingViewNativeIndicatorValues } from './subIndicatorTypes';

const NVI_INITIAL_VALUE = 1000;
const DEFAULT_NVI_MOVING_AVERAGE_PERIOD = 255;

export interface ITradingViewNativeNviResult {
  movingAverage: ITradingViewNativeIndicatorValues;
  nvi: ITradingViewNativeIndicatorValues;
}

/**
 * Negative volume index. It starts at 1,000 and follows the close's relative
 * change only on bars whose volume is lower than the previous bar's; a bar
 * that cannot be compared keeps the previous value.
 *
 * The moving average is exponential and starts from the first index value
 * instead of waiting for a full window, so the default 255-bar average is
 * visible on charts with less history than that.
 */
export function calculateTradingViewNativeNegativeVolumeIndex(
  points: readonly IMarketTokenKLineDataPoint[],
  movingAveragePeriod = DEFAULT_NVI_MOVING_AVERAGE_PERIOD,
): ITradingViewNativeNviResult {
  let value = NVI_INITIAL_VALUE;
  const nvi = buildTradingViewNativeIndicatorValues(points.length, (index) => {
    const point = points[index];
    const previousPoint = points[index - 1];
    if (
      point &&
      previousPoint &&
      isTradingViewNativeFiniteValue(point.c) &&
      isTradingViewNativeFiniteValue(point.v) &&
      isTradingViewNativeFiniteValue(previousPoint.c) &&
      isTradingViewNativeFiniteValue(previousPoint.v) &&
      previousPoint.c !== 0 &&
      point.v < previousPoint.v
    ) {
      value *= point.c / previousPoint.c;
    }
    return value;
  });

  const multiplier =
    2 / (normalizeTradingViewNativeIndicatorPeriod(movingAveragePeriod) + 1);
  let average: number | null = null;
  const movingAverage = buildTradingViewNativeIndicatorValues(
    points.length,
    (index) => {
      const indexValue = nvi[index];
      if (!isTradingViewNativeFiniteValue(indexValue)) {
        return null;
      }
      average =
        average === null
          ? indexValue
          : average + (indexValue - average) * multiplier;
      return average;
    },
  );

  return { movingAverage, nvi };
}
