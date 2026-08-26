// cspell:ignore RSI
import {
  isTradingViewNativeFiniteValue,
  isTradingViewNativeIndicatorZero,
  toTradingViewNativeFiniteValue,
} from './indicatorMath';
import { calculateTradingViewNativeSimpleMovingAverage } from './ma';
import { calculateTradingViewNativeWilderMovingAverage } from './rma';

import type { ITradingViewNativeIndicatorValues } from './subIndicatorTypes';

const DEFAULT_RSI_PERIOD = 14;
const DEFAULT_RSI_MOVING_AVERAGE_PERIOD = 14;

export interface ITradingViewNativeRsiOptions {
  movingAveragePeriod?: number;
  period?: number;
}

export interface ITradingViewNativeRsiResult {
  movingAverage: ITradingViewNativeIndicatorValues;
  rsi: ITradingViewNativeIndicatorValues;
}

export function calculateTradingViewNativeRelativeStrengthIndex(
  values: readonly (number | null | undefined)[],
  {
    movingAveragePeriod = DEFAULT_RSI_MOVING_AVERAGE_PERIOD,
    period = DEFAULT_RSI_PERIOD,
  }: ITradingViewNativeRsiOptions = {},
): ITradingViewNativeRsiResult {
  const gains: ITradingViewNativeIndicatorValues = Array(values.length).fill(
    null,
  );
  const losses: ITradingViewNativeIndicatorValues = Array(values.length).fill(
    null,
  );

  for (let index = 1; index < values.length; index += 1) {
    const currentValue = values[index];
    const previousValue = values[index - 1];
    if (
      isTradingViewNativeFiniteValue(currentValue) &&
      isTradingViewNativeFiniteValue(previousValue)
    ) {
      const change = currentValue - previousValue;
      gains[index] = Math.max(change, 0);
      losses[index] = Math.max(-change, 0);
    }
  }

  const averageGains = calculateTradingViewNativeWilderMovingAverage(
    gains,
    period,
  );
  const averageLosses = calculateTradingViewNativeWilderMovingAverage(
    losses,
    period,
  );
  const rsi: ITradingViewNativeIndicatorValues = Array(values.length).fill(
    null,
  );

  for (let index = 0; index < values.length; index += 1) {
    const averageGain = averageGains[index];
    const averageLoss = averageLosses[index];
    if (
      isTradingViewNativeFiniteValue(averageGain) &&
      isTradingViewNativeFiniteValue(averageLoss)
    ) {
      if (isTradingViewNativeIndicatorZero(averageLoss)) {
        rsi[index] = 100;
      } else if (isTradingViewNativeIndicatorZero(averageGain)) {
        rsi[index] = 0;
      } else {
        const relativeStrength = averageGain / averageLoss;
        rsi[index] = toTradingViewNativeFiniteValue(
          100 - 100 / (1 + relativeStrength),
        );
      }
    }
  }

  return {
    movingAverage: calculateTradingViewNativeSimpleMovingAverage(
      rsi,
      movingAveragePeriod,
    ),
    rsi,
  };
}
