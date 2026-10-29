// cspell:ignore OBV MAOBV
import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

import {
  isTradingViewNativeFiniteValue,
  toTradingViewNativeFiniteValue,
} from './indicatorMath';
import { calculateTradingViewNativeSimpleMovingAverage } from './ma';

import type { ITradingViewNativeIndicatorValues } from './subIndicatorTypes';

const DEFAULT_OBV_MOVING_AVERAGE_PERIOD = 30;

export interface ITradingViewNativeObvResult {
  movingAverage: ITradingViewNativeIndicatorValues;
  obv: ITradingViewNativeIndicatorValues;
}

export interface ITradingViewNativeObvOptions {
  /**
   * Read a zero volume as "not reported" instead of "nothing traded". Stock
   * charts get zero volume for bars their feed has no volume for.
   */
  zeroVolumeIsMissing?: boolean;
}

function hasReportedVolume(volume: number, zeroVolumeIsMissing: boolean) {
  return (
    isTradingViewNativeFiniteValue(volume) &&
    (!zeroVolumeIsMissing || volume > 0)
  );
}

export function calculateTradingViewNativeOnBalanceVolume(
  points: readonly IMarketTokenKLineDataPoint[],
  movingAveragePeriod = DEFAULT_OBV_MOVING_AVERAGE_PERIOD,
  { zeroVolumeIsMissing = false }: ITradingViewNativeObvOptions = {},
): ITradingViewNativeObvResult {
  const obv: ITradingViewNativeIndicatorValues = Array(points.length).fill(
    null,
  );
  // A bar with a close but no volume has no OBV. It is left out entirely: the
  // next bar with volume continues from the last OBV and close instead of the
  // last value being carried on as a flat line, and MAOBV averages only the
  // bars that remain.
  const obvIndexes = points.flatMap((point, index) =>
    point &&
    isTradingViewNativeFiniteValue(point.c) &&
    !hasReportedVolume(point.v, zeroVolumeIsMissing)
      ? []
      : [index],
  );
  let cumulativeVolume: number | null = null;
  let previousClose: number | null = null;

  for (const index of obvIndexes) {
    const point = points[index];
    if (!point || !isTradingViewNativeFiniteValue(point.c)) {
      cumulativeVolume = null;
      previousClose = null;
    } else {
      if (cumulativeVolume === null || previousClose === null) {
        cumulativeVolume = 0;
      } else if (point.c > previousClose) {
        cumulativeVolume += point.v;
      } else if (point.c < previousClose) {
        cumulativeVolume -= point.v;
      }

      cumulativeVolume = toTradingViewNativeFiniteValue(cumulativeVolume);
      if (cumulativeVolume === null) {
        previousClose = null;
      } else {
        obv[index] = cumulativeVolume;
        previousClose = point.c;
      }
    }
  }

  const movingAverage: ITradingViewNativeIndicatorValues = Array(
    points.length,
  ).fill(null);
  calculateTradingViewNativeSimpleMovingAverage(
    obvIndexes.map((index) => obv[index]),
    movingAveragePeriod,
  ).forEach((value, position) => {
    movingAverage[obvIndexes[position]] = value;
  });

  return { movingAverage, obv };
}
