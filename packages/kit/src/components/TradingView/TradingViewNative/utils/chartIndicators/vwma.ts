// cspell:ignore VWMA
import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';
import type { ITradingViewNativeIndicatorSettingsItem } from '@onekeyhq/shared/types/tradingViewNative';

import {
  buildTradingViewNativeIndicatorValues,
  calculateTradingViewNativeRollingSum,
  getTradingViewNativePointValues,
  isTradingViewNativeFiniteValue,
} from './indicatorMath';
import { buildTradingViewNativeMovingAverageSeries } from './movingAverage';

import type { ITradingViewNativeIndicatorValues } from './subIndicatorTypes';

/**
 * Average of `prices` over a full window, each bar weighted by its volume. A
 * window that traded nothing has no average.
 */
export function calculateTradingViewNativeVolumeWeightedAverage(
  prices: readonly (number | null | undefined)[],
  volumes: readonly (number | null | undefined)[],
  period: number,
): ITradingViewNativeIndicatorValues {
  const turnovers = buildTradingViewNativeIndicatorValues(
    prices.length,
    (index) => {
      const price = prices[index];
      const volume = volumes[index];
      return isTradingViewNativeFiniteValue(price) &&
        isTradingViewNativeFiniteValue(volume)
        ? price * volume
        : null;
    },
  );
  const turnoverSums = calculateTradingViewNativeRollingSum(turnovers, period);
  const volumeSums = calculateTradingViewNativeRollingSum(volumes, period);
  return buildTradingViewNativeIndicatorValues(prices.length, (index) => {
    const turnoverSum = turnoverSums[index];
    const volumeSum = volumeSums[index];
    return isTradingViewNativeFiniteValue(turnoverSum) &&
      isTradingViewNativeFiniteValue(volumeSum) &&
      volumeSum !== 0
      ? turnoverSum / volumeSum
      : null;
  });
}

export function calculateTradingViewNativeVolumeWeightedMovingAverage(
  points: readonly IMarketTokenKLineDataPoint[],
  period: number,
): ITradingViewNativeIndicatorValues {
  return calculateTradingViewNativeVolumeWeightedAverage(
    getTradingViewNativePointValues(points, 'c'),
    getTradingViewNativePointValues(points, 'v'),
    period,
  );
}

export function buildTradingViewNativeVwmaSeries(
  points: readonly IMarketTokenKLineDataPoint[],
  settings?: ITradingViewNativeIndicatorSettingsItem,
) {
  return buildTradingViewNativeMovingAverageSeries({
    calculate: (_closeValues, period) =>
      calculateTradingViewNativeVolumeWeightedMovingAverage(points, period),
    indicator: 'VWMA',
    points,
    settings,
  });
}
