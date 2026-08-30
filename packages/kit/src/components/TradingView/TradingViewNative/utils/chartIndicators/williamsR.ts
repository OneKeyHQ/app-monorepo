// cspell:ignore Williams
import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

import {
  calculateTradingViewNativeRollingHighest,
  calculateTradingViewNativeRollingLowest,
  isTradingViewNativeFiniteValue,
  toTradingViewNativeFiniteValue,
} from './indicatorMath';

import type { ITradingViewNativeIndicatorValues } from './subIndicatorTypes';

const DEFAULT_WILLIAMS_R_PERIOD = 14;

export function calculateTradingViewNativeWilliamsR(
  points: readonly IMarketTokenKLineDataPoint[],
  period = DEFAULT_WILLIAMS_R_PERIOD,
): ITradingViewNativeIndicatorValues {
  const highs = points.map((point) =>
    isTradingViewNativeFiniteValue(point.h) ? point.h : null,
  );
  const lows = points.map((point) =>
    isTradingViewNativeFiniteValue(point.l) ? point.l : null,
  );
  const highestHighs = calculateTradingViewNativeRollingHighest(highs, period);
  const lowestLows = calculateTradingViewNativeRollingLowest(lows, period);
  const result: ITradingViewNativeIndicatorValues = Array(points.length).fill(
    null,
  );

  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    const highestHigh = highestHighs[index];
    const lowestLow = lowestLows[index];
    if (
      point &&
      isTradingViewNativeFiniteValue(point.c) &&
      isTradingViewNativeFiniteValue(highestHigh) &&
      isTradingViewNativeFiniteValue(lowestLow)
    ) {
      const range = highestHigh - lowestLow;
      if (range !== 0) {
        result[index] = toTradingViewNativeFiniteValue(
          (100 * (point.c - highestHigh)) / range,
        );
      }
    }
  }

  return result;
}
