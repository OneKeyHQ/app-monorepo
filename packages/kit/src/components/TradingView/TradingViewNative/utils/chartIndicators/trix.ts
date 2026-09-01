// cspell:ignore TRIX
import { calculateTradingViewNativeExponentialMovingAverage } from './ema';
import {
  isTradingViewNativeFiniteValue,
  toTradingViewNativeFiniteValue,
} from './indicatorMath';

import type { ITradingViewNativeIndicatorValues } from './subIndicatorTypes';

const DEFAULT_TRIX_PERIOD = 18;
const TRIX_SCALE = 10_000;

export function calculateTradingViewNativeTrix(
  values: readonly (number | null | undefined)[],
  period = DEFAULT_TRIX_PERIOD,
): ITradingViewNativeIndicatorValues {
  const logarithms = values.map((value) =>
    isTradingViewNativeFiniteValue(value) && value > 0 ? Math.log(value) : null,
  );
  const firstAverage = calculateTradingViewNativeExponentialMovingAverage(
    logarithms,
    period,
  );
  const secondAverage = calculateTradingViewNativeExponentialMovingAverage(
    firstAverage,
    period,
  );
  const thirdAverage = calculateTradingViewNativeExponentialMovingAverage(
    secondAverage,
    period,
  );
  const result: ITradingViewNativeIndicatorValues = Array(values.length).fill(
    null,
  );

  for (let index = 1; index < values.length; index += 1) {
    const currentAverage = thirdAverage[index];
    const previousAverage = thirdAverage[index - 1];
    if (
      isTradingViewNativeFiniteValue(currentAverage) &&
      isTradingViewNativeFiniteValue(previousAverage)
    ) {
      result[index] = toTradingViewNativeFiniteValue(
        TRIX_SCALE * (currentAverage - previousAverage),
      );
    }
  }

  return result;
}
