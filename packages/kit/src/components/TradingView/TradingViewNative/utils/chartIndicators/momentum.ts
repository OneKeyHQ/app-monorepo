// cspell:ignore MTM
import {
  isTradingViewNativeFiniteValue,
  toTradingViewNativeFiniteValue,
} from './indicatorMath';
import { normalizeTradingViewNativeIndicatorPeriod } from './normalizePeriod';

import type { ITradingViewNativeIndicatorValues } from './subIndicatorTypes';

const DEFAULT_MOMENTUM_PERIOD = 10;

export function calculateTradingViewNativeMomentum(
  values: readonly (number | null | undefined)[],
  period = DEFAULT_MOMENTUM_PERIOD,
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
        currentValue - previousValue,
      );
    }
  }

  return result;
}
