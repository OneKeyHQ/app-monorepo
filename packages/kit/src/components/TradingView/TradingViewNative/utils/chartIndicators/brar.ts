// cspell:ignore BRAR
import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

import {
  buildTradingViewNativeIndicatorValues,
  calculateTradingViewNativePercentRatio,
  calculateTradingViewNativeRollingSum,
  isTradingViewNativeFiniteValue,
} from './indicatorMath';

import type { ITradingViewNativeIndicatorValues } from './subIndicatorTypes';

export interface ITradingViewNativeBrarResult {
  ar: ITradingViewNativeIndicatorValues;
  br: ITradingViewNativeIndicatorValues;
}

/**
 * BRAR over `period` bars, times 100. BR compares how far the highs rose above
 * the previous close with how far the lows fell below it; AR compares the
 * distance from the open up to the high with the distance down to the low.
 */
export function calculateTradingViewNativeBrar(
  points: readonly IMarketTokenKLineDataPoint[],
  period = 26,
): ITradingViewNativeBrarResult {
  const getDistanceSums = (
    getDistance: (
      point: IMarketTokenKLineDataPoint,
      previousClose: number | undefined,
    ) => number | null,
  ) =>
    calculateTradingViewNativeRollingSum(
      buildTradingViewNativeIndicatorValues(points.length, (index) => {
        const point = points[index];
        return point &&
          isTradingViewNativeFiniteValue(point.h) &&
          isTradingViewNativeFiniteValue(point.l) &&
          isTradingViewNativeFiniteValue(point.o)
          ? getDistance(point, points[index - 1]?.c)
          : null;
      }),
      period,
    );
  return {
    ar: calculateTradingViewNativePercentRatio(
      getDistanceSums((point) => point.h - point.o),
      getDistanceSums((point) => point.o - point.l),
    ),
    br: calculateTradingViewNativePercentRatio(
      getDistanceSums((point, previousClose) =>
        isTradingViewNativeFiniteValue(previousClose)
          ? Math.max(point.h - previousClose, 0)
          : null,
      ),
      getDistanceSums((point, previousClose) =>
        isTradingViewNativeFiniteValue(previousClose)
          ? Math.max(previousClose - point.l, 0)
          : null,
      ),
    ),
  };
}
