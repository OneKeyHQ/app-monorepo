import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

import {
  buildTradingViewNativeIndicatorValues,
  calculateTradingViewNativePercentRatio,
  calculateTradingViewNativeRollingSum,
  isTradingViewNativeFiniteValue,
} from './indicatorMath';
import { calculateTradingViewNativeSimpleMovingAverage } from './ma';

import type { ITradingViewNativeIndicatorValues } from './subIndicatorTypes';

export interface ITradingViewNativeVrOptions {
  movingAveragePeriod?: number;
  period?: number;
}

export interface ITradingViewNativeVrResult {
  movingAverage: ITradingViewNativeIndicatorValues;
  vr: ITradingViewNativeIndicatorValues;
}

/**
 * Volume ratio: volume of rising bars against volume of falling bars over
 * `period` bars, times 100. Half of the volume of unchanged bars goes to each
 * side.
 */
export function calculateTradingViewNativeVolumeRatio(
  points: readonly IMarketTokenKLineDataPoint[],
  { movingAveragePeriod = 6, period = 26 }: ITradingViewNativeVrOptions = {},
): ITradingViewNativeVrResult {
  const getSideVolumes = (side: 'down' | 'up') =>
    buildTradingViewNativeIndicatorValues(points.length, (index) => {
      const close = points[index]?.c;
      const volume = points[index]?.v;
      const previousClose = points[index - 1]?.c;
      if (
        !isTradingViewNativeFiniteValue(close) ||
        !isTradingViewNativeFiniteValue(volume) ||
        !isTradingViewNativeFiniteValue(previousClose)
      ) {
        return null;
      }
      if (close === previousClose) {
        return volume / 2;
      }
      return close > previousClose === (side === 'up') ? volume : 0;
    });
  const vr = calculateTradingViewNativePercentRatio(
    calculateTradingViewNativeRollingSum(getSideVolumes('up'), period),
    calculateTradingViewNativeRollingSum(getSideVolumes('down'), period),
  );
  return {
    movingAverage: calculateTradingViewNativeSimpleMovingAverage(
      vr,
      movingAveragePeriod,
    ),
    vr,
  };
}
