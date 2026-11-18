// cspell:ignore Bollinger Keltner
import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

import {
  buildTradingViewNativeIndicatorValues,
  calculateTradingViewNativeLinearRegression,
  calculateTradingViewNativeRollingHighest,
  calculateTradingViewNativeRollingLowest,
  calculateTradingViewNativeRollingStandardDeviation,
  calculateTradingViewNativeTrueRange,
  getTradingViewNativePointValues,
  isTradingViewNativeFiniteValue,
} from './indicatorMath';
import { calculateTradingViewNativeSimpleMovingAverage } from './ma';

import type { ITradingViewNativeIndicatorValues } from './subIndicatorTypes';

export const TRADING_VIEW_NATIVE_SQUEEZE_ON = 1;
export const TRADING_VIEW_NATIVE_SQUEEZE_OFF = -1;
export const TRADING_VIEW_NATIVE_SQUEEZE_NONE = 0;

export interface ITradingViewNativeSqueezeMomentumOptions {
  bollingerMultiplier?: number;
  bollingerPeriod?: number;
  keltnerMultiplier?: number;
  keltnerPeriod?: number;
  momentumPeriod?: number;
}

export interface ITradingViewNativeSqueezeMomentumResult {
  momentum: ITradingViewNativeIndicatorValues;
  /** 1 while the Bollinger Bands sit inside the Keltner Channel, -1 while they sit outside, 0 otherwise. */
  squeeze: ITradingViewNativeIndicatorValues;
}

/**
 * Squeeze momentum. The momentum is a linear regression of the close's
 * distance from the middle of its recent range; the squeeze state compares
 * the Bollinger Bands with the Keltner Channel.
 */
export function calculateTradingViewNativeSqueezeMomentum(
  points: readonly IMarketTokenKLineDataPoint[],
  {
    bollingerMultiplier = 2,
    bollingerPeriod = 20,
    keltnerMultiplier = 1.5,
    keltnerPeriod = 20,
    momentumPeriod = 12,
  }: ITradingViewNativeSqueezeMomentumOptions = {},
): ITradingViewNativeSqueezeMomentumResult {
  const closes = getTradingViewNativePointValues(points, 'c');
  const highestHighs = calculateTradingViewNativeRollingHighest(
    getTradingViewNativePointValues(points, 'h'),
    keltnerPeriod,
  );
  const lowestLows = calculateTradingViewNativeRollingLowest(
    getTradingViewNativePointValues(points, 'l'),
    keltnerPeriod,
  );
  const keltnerAverages = calculateTradingViewNativeSimpleMovingAverage(
    closes,
    keltnerPeriod,
  );
  const momentum = calculateTradingViewNativeLinearRegression(
    buildTradingViewNativeIndicatorValues(points.length, (index) => {
      const close = closes[index];
      const highestHigh = highestHighs[index];
      const lowestLow = lowestLows[index];
      const keltnerAverage = keltnerAverages[index];
      return isTradingViewNativeFiniteValue(close) &&
        isTradingViewNativeFiniteValue(highestHigh) &&
        isTradingViewNativeFiniteValue(lowestLow) &&
        isTradingViewNativeFiniteValue(keltnerAverage)
        ? close - ((highestHigh + lowestLow) / 2 + keltnerAverage) / 2
        : null;
    }),
    momentumPeriod,
  );

  const bollingerAverages = calculateTradingViewNativeSimpleMovingAverage(
    closes,
    bollingerPeriod,
  );
  const bollingerDeviations =
    calculateTradingViewNativeRollingStandardDeviation(closes, bollingerPeriod);
  const averageRanges = calculateTradingViewNativeSimpleMovingAverage(
    calculateTradingViewNativeTrueRange(points),
    keltnerPeriod,
  );
  const squeeze = buildTradingViewNativeIndicatorValues(
    points.length,
    (index) => {
      const bollingerAverage = bollingerAverages[index];
      const bollingerDeviation = bollingerDeviations[index];
      const keltnerAverage = keltnerAverages[index];
      const averageRange = averageRanges[index];
      if (
        !isTradingViewNativeFiniteValue(bollingerAverage) ||
        !isTradingViewNativeFiniteValue(bollingerDeviation) ||
        !isTradingViewNativeFiniteValue(keltnerAverage) ||
        !isTradingViewNativeFiniteValue(averageRange)
      ) {
        return null;
      }
      const bollingerWidth = bollingerMultiplier * bollingerDeviation;
      const keltnerWidth = keltnerMultiplier * averageRange;
      const upperGap =
        keltnerAverage + keltnerWidth - (bollingerAverage + bollingerWidth);
      const lowerGap =
        bollingerAverage - bollingerWidth - (keltnerAverage - keltnerWidth);
      if (upperGap > 0 && lowerGap > 0) {
        return TRADING_VIEW_NATIVE_SQUEEZE_ON;
      }
      if (upperGap < 0 && lowerGap < 0) {
        return TRADING_VIEW_NATIVE_SQUEEZE_OFF;
      }
      return TRADING_VIEW_NATIVE_SQUEEZE_NONE;
    },
  );

  return { momentum, squeeze };
}
