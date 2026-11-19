// cspell:ignore ROC
import {
  isTradingViewNativeFiniteValue,
  toTradingViewNativeFiniteValue,
} from './indicatorMath';
import { normalizeTradingViewNativeIndicatorPeriod } from './normalizePeriod';

import type { ITradingViewNativeIndicatorValues } from './subIndicatorTypes';

const DEFAULT_RATE_OF_CHANGE_PERIOD = 9;

export function calculateTradingViewNativeRateOfChange(
  values: readonly (number | null | undefined)[],
  period = DEFAULT_RATE_OF_CHANGE_PERIOD,
): ITradingViewNativeIndicatorValues {
  const normalizedPeriod = normalizeTradingViewNativeIndicatorPeriod(period);
  const result: ITradingViewNativeIndicatorValues = Array(values.length).fill(
    null,
  );

  for (let index = normalizedPeriod; index < values.length; index += 1) {
    const currentValue = values[index];
    const previousValue = values[index - normalizedPeriod];
    if (
      isTradingViewNativeFiniteValue(currentValue) &&
      isTradingViewNativeFiniteValue(previousValue) &&
      previousValue !== 0
    ) {
      result[index] = toTradingViewNativeFiniteValue(
        (100 * (currentValue - previousValue)) / previousValue,
      );
    }
  }

  return result;
}
