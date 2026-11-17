// cspell:ignore MACD
import { calculateTradingViewNativeExponentialMovingAverage } from './ema';
import {
  isTradingViewNativeFiniteValue,
  toTradingViewNativeFiniteValue,
} from './indicatorMath';

import type { ITradingViewNativeIndicatorValues } from './subIndicatorTypes';

const DEFAULT_MACD_FAST_PERIOD = 12;
const DEFAULT_MACD_SLOW_PERIOD = 26;
const DEFAULT_MACD_SIGNAL_PERIOD = 9;

export interface ITradingViewNativeMacdOptions {
  fastPeriod?: number;
  signalPeriod?: number;
  slowPeriod?: number;
}

export interface ITradingViewNativeMacdResult {
  histogram: ITradingViewNativeIndicatorValues;
  macd: ITradingViewNativeIndicatorValues;
  signal: ITradingViewNativeIndicatorValues;
}

export function calculateTradingViewNativeMacd(
  values: readonly (number | null | undefined)[],
  {
    fastPeriod = DEFAULT_MACD_FAST_PERIOD,
    signalPeriod = DEFAULT_MACD_SIGNAL_PERIOD,
    slowPeriod = DEFAULT_MACD_SLOW_PERIOD,
  }: ITradingViewNativeMacdOptions = {},
): ITradingViewNativeMacdResult {
  const fastAverage = calculateTradingViewNativeExponentialMovingAverage(
    values,
    fastPeriod,
  );
  const slowAverage = calculateTradingViewNativeExponentialMovingAverage(
    values,
    slowPeriod,
  );
  const macd: ITradingViewNativeIndicatorValues = Array(values.length).fill(
    null,
  );

  for (let index = 0; index < values.length; index += 1) {
    const fastValue = fastAverage[index];
    const slowValue = slowAverage[index];
    if (
      isTradingViewNativeFiniteValue(fastValue) &&
      isTradingViewNativeFiniteValue(slowValue)
    ) {
      macd[index] = toTradingViewNativeFiniteValue(fastValue - slowValue);
    }
  }

  const signal = calculateTradingViewNativeExponentialMovingAverage(
    macd,
    signalPeriod,
  );
  const histogram: ITradingViewNativeIndicatorValues = Array(
    values.length,
  ).fill(null);

  for (let index = 0; index < values.length; index += 1) {
    const macdValue = macd[index];
    const signalValue = signal[index];
    if (
      isTradingViewNativeFiniteValue(macdValue) &&
      isTradingViewNativeFiniteValue(signalValue)
    ) {
      histogram[index] = toTradingViewNativeFiniteValue(
        macdValue - signalValue,
      );
    }
  }

  return { histogram, macd, signal };
}
