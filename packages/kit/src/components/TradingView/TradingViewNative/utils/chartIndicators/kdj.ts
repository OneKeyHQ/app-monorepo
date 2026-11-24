// cspell:ignore KDJ SKDJ
import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

import { calculateTradingViewNativeExponentialMovingAverage } from './ema';
import {
  buildTradingViewNativeIndicatorValues,
  calculateTradingViewNativeRollingHighest,
  calculateTradingViewNativeRollingLowest,
  getTradingViewNativePointValues,
  isTradingViewNativeFiniteValue,
} from './indicatorMath';
import { calculateTradingViewNativeSimpleMovingAverage } from './ma';
import { normalizeTradingViewNativeIndicatorPeriod } from './normalizePeriod';

import type { ITradingViewNativeIndicatorValues } from './subIndicatorTypes';

const DEFAULT_KDJ_PERIOD = 9;
const DEFAULT_KDJ_SMOOTHING_PERIOD = 3;
const KDJ_INITIAL_VALUE = 50;

export interface ITradingViewNativeKdjOptions {
  dPeriod?: number;
  kPeriod?: number;
  period?: number;
}

export interface ITradingViewNativeKdjResult {
  d: ITradingViewNativeIndicatorValues;
  j: ITradingViewNativeIndicatorValues;
  k: ITradingViewNativeIndicatorValues;
}

export interface ITradingViewNativeSkdjOptions {
  period?: number;
  smoothingPeriod?: number;
}

export interface ITradingViewNativeSkdjResult {
  d: ITradingViewNativeIndicatorValues;
  k: ITradingViewNativeIndicatorValues;
}

/**
 * Raw stochastic value: where the close sits between the lowest low and the
 * highest high of the latest `period` bars, from 0 to 100. A window whose
 * high equals its low repeats the previous value.
 */
export function calculateTradingViewNativeRawStochastic(
  points: readonly IMarketTokenKLineDataPoint[],
  period: number,
): ITradingViewNativeIndicatorValues {
  const highestHighs = calculateTradingViewNativeRollingHighest(
    getTradingViewNativePointValues(points, 'h'),
    period,
  );
  const lowestLows = calculateTradingViewNativeRollingLowest(
    getTradingViewNativePointValues(points, 'l'),
    period,
  );
  let previousValue = KDJ_INITIAL_VALUE;
  return buildTradingViewNativeIndicatorValues(points.length, (index) => {
    const close = points[index]?.c;
    const highestHigh = highestHighs[index];
    const lowestLow = lowestLows[index];
    if (
      !isTradingViewNativeFiniteValue(close) ||
      !isTradingViewNativeFiniteValue(highestHigh) ||
      !isTradingViewNativeFiniteValue(lowestLow)
    ) {
      return null;
    }
    const range = highestHigh - lowestLow;
    if (range !== 0) {
      previousValue = (100 * (close - lowestLow)) / range;
    }
    return previousValue;
  });
}

/**
 * KDJ. K and D are recursive averages that give the new value a weight of
 * `1 / period` and start from 50; J is `3K - 2D`.
 */
export function calculateTradingViewNativeKdj(
  points: readonly IMarketTokenKLineDataPoint[],
  {
    dPeriod = DEFAULT_KDJ_SMOOTHING_PERIOD,
    kPeriod = DEFAULT_KDJ_SMOOTHING_PERIOD,
    period = DEFAULT_KDJ_PERIOD,
  }: ITradingViewNativeKdjOptions = {},
): ITradingViewNativeKdjResult {
  const normalizedKPeriod = normalizeTradingViewNativeIndicatorPeriod(kPeriod);
  const normalizedDPeriod = normalizeTradingViewNativeIndicatorPeriod(dPeriod);
  const rawValues = calculateTradingViewNativeRawStochastic(points, period);
  const k: ITradingViewNativeIndicatorValues = Array(points.length).fill(null);
  const d: ITradingViewNativeIndicatorValues = Array(points.length).fill(null);
  const j: ITradingViewNativeIndicatorValues = Array(points.length).fill(null);
  let previousK = KDJ_INITIAL_VALUE;
  let previousD = KDJ_INITIAL_VALUE;

  for (let index = 0; index < points.length; index += 1) {
    const rawValue = rawValues[index];
    if (isTradingViewNativeFiniteValue(rawValue)) {
      previousK =
        (rawValue + (normalizedKPeriod - 1) * previousK) / normalizedKPeriod;
      previousD =
        (previousK + (normalizedDPeriod - 1) * previousD) / normalizedDPeriod;
      k[index] = previousK;
      d[index] = previousD;
      j[index] = 3 * previousK - 2 * previousD;
    }
  }

  return { d, j, k };
}

/**
 * Slow KDJ. K is the raw stochastic value smoothed twice by an exponential
 * average; D is the simple average of K.
 */
export function calculateTradingViewNativeSkdj(
  points: readonly IMarketTokenKLineDataPoint[],
  {
    period = DEFAULT_KDJ_PERIOD,
    smoothingPeriod = DEFAULT_KDJ_SMOOTHING_PERIOD,
  }: ITradingViewNativeSkdjOptions = {},
): ITradingViewNativeSkdjResult {
  const k = calculateTradingViewNativeExponentialMovingAverage(
    calculateTradingViewNativeExponentialMovingAverage(
      calculateTradingViewNativeRawStochastic(points, period),
      smoothingPeriod,
    ),
    smoothingPeriod,
  );
  return {
    d: calculateTradingViewNativeSimpleMovingAverage(k, smoothingPeriod),
    k,
  };
}
