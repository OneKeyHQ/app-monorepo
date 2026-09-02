// cspell:ignore Stoch RSI
import {
  calculateTradingViewNativeRollingHighest,
  calculateTradingViewNativeRollingLowest,
  isTradingViewNativeFiniteValue,
  toTradingViewNativeFiniteValue,
} from './indicatorMath';
import { calculateTradingViewNativeSimpleMovingAverage } from './ma';
import { calculateTradingViewNativeRelativeStrengthIndex } from './rsi';

import type { ITradingViewNativeIndicatorValues } from './subIndicatorTypes';

const DEFAULT_STOCHASTIC_RSI_PERIOD = 14;
const DEFAULT_STOCHASTIC_RSI_STOCHASTIC_PERIOD = 14;
const DEFAULT_STOCHASTIC_RSI_K_PERIOD = 3;
const DEFAULT_STOCHASTIC_RSI_D_PERIOD = 3;

export interface ITradingViewNativeStochasticRsiOptions {
  dPeriod?: number;
  kPeriod?: number;
  rsiPeriod?: number;
  stochasticPeriod?: number;
}

export interface ITradingViewNativeStochasticRsiResult {
  d: ITradingViewNativeIndicatorValues;
  k: ITradingViewNativeIndicatorValues;
}

export function calculateTradingViewNativeStochasticRsi(
  values: readonly (number | null | undefined)[],
  {
    dPeriod = DEFAULT_STOCHASTIC_RSI_D_PERIOD,
    kPeriod = DEFAULT_STOCHASTIC_RSI_K_PERIOD,
    rsiPeriod = DEFAULT_STOCHASTIC_RSI_PERIOD,
    stochasticPeriod = DEFAULT_STOCHASTIC_RSI_STOCHASTIC_PERIOD,
  }: ITradingViewNativeStochasticRsiOptions = {},
): ITradingViewNativeStochasticRsiResult {
  const { rsi } = calculateTradingViewNativeRelativeStrengthIndex(values, {
    period: rsiPeriod,
  });
  const highestRsi = calculateTradingViewNativeRollingHighest(
    rsi,
    stochasticPeriod,
  );
  const lowestRsi = calculateTradingViewNativeRollingLowest(
    rsi,
    stochasticPeriod,
  );
  const raw: ITradingViewNativeIndicatorValues = Array(values.length).fill(
    null,
  );
  let previousRaw: number | null = null;

  for (let index = 0; index < values.length; index += 1) {
    const rsiValue = rsi[index];
    const highestValue = highestRsi[index];
    const lowestValue = lowestRsi[index];
    if (
      isTradingViewNativeFiniteValue(rsiValue) &&
      isTradingViewNativeFiniteValue(highestValue) &&
      isTradingViewNativeFiniteValue(lowestValue)
    ) {
      const range = highestValue - lowestValue;
      if (range === 0) {
        raw[index] = previousRaw;
      } else {
        const rawValue = toTradingViewNativeFiniteValue(
          (100 * (rsiValue - lowestValue)) / range,
        );
        raw[index] = rawValue;
        if (rawValue !== null) {
          previousRaw = rawValue;
        }
      }
    }
  }

  const k = calculateTradingViewNativeSimpleMovingAverage(raw, kPeriod);
  const d = calculateTradingViewNativeSimpleMovingAverage(k, dPeriod);

  return { d, k };
}
