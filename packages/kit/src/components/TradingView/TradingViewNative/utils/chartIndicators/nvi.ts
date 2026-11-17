// cspell:ignore NVI
import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

import {
  hasTradingViewNativeAnyVolume,
  hasTradingViewNativeReportedVolume,
  isTradingViewNativeFiniteValue,
} from './indicatorMath';
import { normalizeTradingViewNativeIndicatorPeriod } from './normalizePeriod';

import type { ITradingViewNativeIndicatorValues } from './subIndicatorTypes';

const NVI_INITIAL_VALUE = 1000;
const DEFAULT_NVI_MOVING_AVERAGE_PERIOD = 255;

export interface ITradingViewNativeNviOptions {
  /**
   * Read a zero volume as "not reported" instead of "nothing traded". Stock
   * charts get zero volume for bars their feed has no volume for.
   */
  zeroVolumeIsMissing?: boolean;
}

export interface ITradingViewNativeNviResult {
  movingAverage: ITradingViewNativeIndicatorValues;
  nvi: ITradingViewNativeIndicatorValues;
}

/**
 * Negative volume index. It starts at 1,000 and follows the close's relative
 * change only on bars whose volume is lower than the previous bar's.
 *
 * A bar without a close or a reported volume has no index. It is left out
 * entirely: the next bar is compared with the last bar that had both, so a
 * missing volume is never read as a drop in volume. A source that reports no
 * volume at all has no index.
 *
 * The moving average is exponential and starts from the first index value
 * instead of waiting for a full window, so the default 255-bar average is
 * visible on charts with less history than that.
 */
export function calculateTradingViewNativeNegativeVolumeIndex(
  points: readonly IMarketTokenKLineDataPoint[],
  movingAveragePeriod = DEFAULT_NVI_MOVING_AVERAGE_PERIOD,
  { zeroVolumeIsMissing = false }: ITradingViewNativeNviOptions = {},
): ITradingViewNativeNviResult {
  const nvi: ITradingViewNativeIndicatorValues = Array(points.length).fill(
    null,
  );
  const movingAverage: ITradingViewNativeIndicatorValues = Array(
    points.length,
  ).fill(null);
  if (!hasTradingViewNativeAnyVolume(points)) {
    return { movingAverage, nvi };
  }

  const multiplier =
    2 / (normalizeTradingViewNativeIndicatorPeriod(movingAveragePeriod) + 1);
  let value = NVI_INITIAL_VALUE;
  let average: number | null = null;
  let previousPoint: IMarketTokenKLineDataPoint | null = null;

  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    if (
      point &&
      isTradingViewNativeFiniteValue(point.c) &&
      hasTradingViewNativeReportedVolume(point.v, zeroVolumeIsMissing)
    ) {
      if (previousPoint && previousPoint.c !== 0 && point.v < previousPoint.v) {
        value *= point.c / previousPoint.c;
      }
      if (!Number.isFinite(value)) {
        break;
      }
      previousPoint = point;
      average =
        average === null ? value : average + (value - average) * multiplier;
      nvi[index] = value;
      movingAverage[index] = average;
    }
  }

  return { movingAverage, nvi };
}
