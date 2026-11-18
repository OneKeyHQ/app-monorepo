// cspell:ignore PMO
import { calculateTradingViewNativeExponentialMovingAverage } from './ema';
import { isTradingViewNativeFiniteValue } from './indicatorMath';
import { calculateTradingViewNativeRateOfChange } from './rateOfChange';

import type { ITradingViewNativeIndicatorValues } from './subIndicatorTypes';

const PMO_SCALE = 10;

export interface ITradingViewNativePmoOptions {
  firstPeriod?: number;
  secondPeriod?: number;
  signalPeriod?: number;
}

export interface ITradingViewNativePmoResult {
  pmo: ITradingViewNativeIndicatorValues;
  signal: ITradingViewNativeIndicatorValues;
}

/**
 * Price momentum oscillator: the one-bar percentage change smoothed by two
 * exponential averages, the first one scaled by 10. The signal is an
 * exponential average of the oscillator.
 */
export function calculateTradingViewNativePriceMomentumOscillator(
  values: readonly (number | null | undefined)[],
  {
    firstPeriod = 35,
    secondPeriod = 20,
    signalPeriod = 10,
  }: ITradingViewNativePmoOptions = {},
): ITradingViewNativePmoResult {
  const pmo = calculateTradingViewNativeExponentialMovingAverage(
    calculateTradingViewNativeExponentialMovingAverage(
      calculateTradingViewNativeRateOfChange(values, 1),
      firstPeriod,
    ).map((value) =>
      isTradingViewNativeFiniteValue(value) ? PMO_SCALE * value : null,
    ),
    secondPeriod,
  );
  return {
    pmo,
    signal: calculateTradingViewNativeExponentialMovingAverage(
      pmo,
      signalPeriod,
    ),
  };
}
