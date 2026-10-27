// cspell:ignore OBV
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

export function calculateTradingViewNativeOnBalanceVolume(
  points: readonly IMarketTokenKLineDataPoint[],
  movingAveragePeriod = DEFAULT_OBV_MOVING_AVERAGE_PERIOD,
): ITradingViewNativeObvResult {
  const obv: ITradingViewNativeIndicatorValues = Array(points.length).fill(
    null,
  );
  let cumulativeVolume: number | null = null;
  let previousClose: number | null = null;

  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    const isInvalidPoint =
      !point ||
      !isTradingViewNativeFiniteValue(point.c) ||
      !isTradingViewNativeFiniteValue(point.v);
    if (isInvalidPoint) {
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

  return {
    movingAverage: calculateTradingViewNativeSimpleMovingAverage(
      obv,
      movingAveragePeriod,
    ),
    obv,
  };
}
