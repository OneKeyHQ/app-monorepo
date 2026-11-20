// cspell:ignore lookbacks
import { calculateTradingViewNativeExponentialMovingAverage } from './ema';
import {
  buildTradingViewNativeIndicatorValues,
  isTradingViewNativeFiniteValue,
} from './indicatorMath';
import { normalizeTradingViewNativeIndicatorPeriod } from './normalizePeriod';

import type { ITradingViewNativeIndicatorValues } from './subIndicatorTypes';

/**
 * Scale of the slope readout. It has no unit of its own: it is the factor the
 * exchange charts this indicator was matched against apply to the relative
 * change, measured there for lookbacks of 1 and 2, average lengths of 10 and
 * 20, and hourly and daily bars. Keeping it makes the readout comparable.
 */
const MA_SLOPE_SCALE = 6392;

export interface ITradingViewNativeMaSlopeOptions {
  lookback?: number;
  period?: number;
}

/**
 * Moving average slope: the relative change of the exponential average of
 * the values against the average `lookback` bars earlier, scaled. Positive
 * while the average rises, negative while it falls.
 */
export function calculateTradingViewNativeMaSlope(
  values: readonly (number | null | undefined)[],
  { lookback = 1, period = 20 }: ITradingViewNativeMaSlopeOptions = {},
): ITradingViewNativeIndicatorValues {
  const normalizedLookback =
    normalizeTradingViewNativeIndicatorPeriod(lookback);
  const averages = calculateTradingViewNativeExponentialMovingAverage(
    values,
    period,
  );
  return buildTradingViewNativeIndicatorValues(values.length, (index) => {
    const average = averages[index];
    const earlierAverage = averages[index - normalizedLookback];
    return isTradingViewNativeFiniteValue(average) &&
      isTradingViewNativeFiniteValue(earlierAverage) &&
      earlierAverage !== 0
      ? (MA_SLOPE_SCALE * (average - earlierAverage)) / earlierAverage
      : null;
  });
}
