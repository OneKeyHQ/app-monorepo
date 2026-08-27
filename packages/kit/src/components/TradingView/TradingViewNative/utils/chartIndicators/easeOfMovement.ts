// cspell:ignore EOM
import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

import {
  getTradingViewNativePriceMidpoint,
  isTradingViewNativeFiniteValue,
  toTradingViewNativeFiniteValue,
} from './indicatorMath';
import { calculateTradingViewNativeSimpleMovingAverage } from './ma';

import type { ITradingViewNativeIndicatorValues } from './subIndicatorTypes';

const DEFAULT_EASE_OF_MOVEMENT_DIVISOR = 10_000;
const DEFAULT_EASE_OF_MOVEMENT_PERIOD = 14;

export interface ITradingViewNativeEaseOfMovementOptions {
  divisor?: number;
  period?: number;
}

export function calculateTradingViewNativeEaseOfMovement(
  points: readonly IMarketTokenKLineDataPoint[],
  {
    divisor = DEFAULT_EASE_OF_MOVEMENT_DIVISOR,
    period = DEFAULT_EASE_OF_MOVEMENT_PERIOD,
  }: ITradingViewNativeEaseOfMovementOptions = {},
): ITradingViewNativeIndicatorValues {
  const normalizedDivisor = isTradingViewNativeFiniteValue(divisor)
    ? divisor
    : DEFAULT_EASE_OF_MOVEMENT_DIVISOR;
  const midpoints = points.map(getTradingViewNativePriceMidpoint);
  const rawValues: ITradingViewNativeIndicatorValues = Array(
    points.length,
  ).fill(null);

  for (let index = 1; index < points.length; index += 1) {
    const point = points[index];
    const midpoint = midpoints[index];
    const previousMidpoint = midpoints[index - 1];
    if (
      point &&
      isTradingViewNativeFiniteValue(point.h) &&
      isTradingViewNativeFiniteValue(point.l) &&
      isTradingViewNativeFiniteValue(point.v) &&
      isTradingViewNativeFiniteValue(midpoint) &&
      isTradingViewNativeFiniteValue(previousMidpoint) &&
      point.v !== 0
    ) {
      const distance = midpoint - previousMidpoint;
      const range = point.h - point.l;
      rawValues[index] = toTradingViewNativeFiniteValue(
        (normalizedDivisor * distance * range) / point.v,
      );
    }
  }

  return calculateTradingViewNativeSimpleMovingAverage(rawValues, period);
}
