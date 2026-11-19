// cspell:ignore KST
import {
  buildTradingViewNativeIndicatorValues,
  isTradingViewNativeFiniteValue,
} from './indicatorMath';
import { calculateTradingViewNativeSimpleMovingAverage } from './ma';
import { calculateTradingViewNativeRateOfChange } from './rateOfChange';

import type { ITradingViewNativeIndicatorValues } from './subIndicatorTypes';

export interface ITradingViewNativeKstOptions {
  /** Rate-of-change lengths of the four components, shortest first. */
  rocPeriods?: readonly [number, number, number, number];
  signalPeriod?: number;
  /** Simple-average lengths that smooth the four components. */
  smoothingPeriods?: readonly [number, number, number, number];
}

export interface ITradingViewNativeKstResult {
  kst: ITradingViewNativeIndicatorValues;
  signal: ITradingViewNativeIndicatorValues;
}

/**
 * Know sure thing: four smoothed rates of change, the longer ones weighted
 * more (1, 2, 3 and 4), and a simple average of their sum as the signal.
 */
export function calculateTradingViewNativeKst(
  values: readonly (number | null | undefined)[],
  {
    rocPeriods = [10, 15, 20, 30],
    signalPeriod = 9,
    smoothingPeriods = [10, 10, 10, 15],
  }: ITradingViewNativeKstOptions = {},
): ITradingViewNativeKstResult {
  const components = rocPeriods.map((rocPeriod, index) =>
    calculateTradingViewNativeSimpleMovingAverage(
      calculateTradingViewNativeRateOfChange(values, rocPeriod),
      smoothingPeriods[index] ?? 1,
    ),
  );
  const kst = buildTradingViewNativeIndicatorValues(values.length, (index) => {
    let sum = 0;
    for (let weight = 1; weight <= components.length; weight += 1) {
      const component = components[weight - 1]?.[index];
      if (!isTradingViewNativeFiniteValue(component)) {
        return null;
      }
      sum += weight * component;
    }
    return sum;
  });
  return {
    kst,
    signal: calculateTradingViewNativeSimpleMovingAverage(kst, signalPeriod),
  };
}
