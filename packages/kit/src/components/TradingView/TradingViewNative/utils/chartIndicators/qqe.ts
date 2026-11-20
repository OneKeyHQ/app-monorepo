// cspell:ignore QQE Wilder
import { calculateTradingViewNativeExponentialMovingAverage } from './ema';
import {
  buildTradingViewNativeIndicatorValues,
  isTradingViewNativeFiniteValue,
} from './indicatorMath';
import { normalizeTradingViewNativeIndicatorPeriod } from './normalizePeriod';
import { calculateTradingViewNativeRelativeStrengthIndex } from './rsi';

import type { ITradingViewNativeIndicatorValues } from './subIndicatorTypes';

export interface ITradingViewNativeQqeOptions {
  fastFactor?: number;
  rsiPeriod?: number;
  slowFactor?: number;
  smoothingPeriod?: number;
}

export interface ITradingViewNativeQqeResult {
  fast: ITradingViewNativeIndicatorValues;
  rsi: ITradingViewNativeIndicatorValues;
  slow: ITradingViewNativeIndicatorValues;
}

function isCrossing({
  current,
  previous,
  reference,
  previousReference,
}: {
  current: number;
  previous: number;
  previousReference: number;
  reference: number;
}) {
  return (
    (current > reference && previous <= previousReference) ||
    (current < reference && previous >= previousReference)
  );
}

/**
 * Trailing line that follows the smoothed RSI at a distance of
 * `factor * band`. It ratchets toward the RSI while the RSI stays on one side
 * and flips to the other side when the RSI crosses it.
 */
function calculateTrailingLine(
  smoothedRsi: ITradingViewNativeIndicatorValues,
  bandWidths: ITradingViewNativeIndicatorValues,
  factor: number,
): ITradingViewNativeIndicatorValues {
  // Band values of the previous bar and the bar before it.
  let longBands: [number, number] = [0, 0];
  let shortBands: [number, number] = [0, 0];
  let isRising = true;

  return buildTradingViewNativeIndicatorValues(smoothedRsi.length, (index) => {
    const value = smoothedRsi[index];
    const bandWidth = bandWidths[index];
    if (
      !isTradingViewNativeFiniteValue(value) ||
      !isTradingViewNativeFiniteValue(bandWidth)
    ) {
      return null;
    }
    const previousValue = smoothedRsi[index - 1];
    const distance = factor * bandWidth;
    const [previousLongBand, olderLongBand] = longBands;
    const [previousShortBand, olderShortBand] = shortBands;
    let longBand = value - distance;
    let shortBand = value + distance;
    if (isTradingViewNativeFiniteValue(previousValue)) {
      if (previousValue > previousLongBand && value > previousLongBand) {
        longBand = Math.max(previousLongBand, longBand);
      }
      if (previousValue < previousShortBand && value < previousShortBand) {
        shortBand = Math.min(previousShortBand, shortBand);
      }
      if (
        isCrossing({
          current: value,
          previous: previousValue,
          previousReference: olderShortBand,
          reference: previousShortBand,
        })
      ) {
        isRising = true;
      } else if (
        isCrossing({
          current: value,
          previous: previousValue,
          previousReference: olderLongBand,
          reference: previousLongBand,
        })
      ) {
        isRising = false;
      }
    }
    longBands = [longBand, previousLongBand];
    shortBands = [shortBand, previousShortBand];
    return isRising ? longBand : shortBand;
  });
}

/**
 * Quantitative qualitative estimation: an exponentially smoothed RSI with a
 * fast and a slow trailing line. The lines keep a distance that is a multiple
 * of the RSI's own average movement, smoothed twice over `2 * rsiPeriod - 1`
 * bars.
 */
export function calculateTradingViewNativeQqe(
  values: readonly (number | null | undefined)[],
  {
    fastFactor = 2.618,
    rsiPeriod = 14,
    slowFactor = 4.236,
    smoothingPeriod = 2,
  }: ITradingViewNativeQqeOptions = {},
): ITradingViewNativeQqeResult {
  const normalizedRsiPeriod =
    normalizeTradingViewNativeIndicatorPeriod(rsiPeriod);
  const rsi = calculateTradingViewNativeExponentialMovingAverage(
    calculateTradingViewNativeRelativeStrengthIndex(values, {
      period: normalizedRsiPeriod,
    }).rsi,
    smoothingPeriod,
  );
  const movements = buildTradingViewNativeIndicatorValues(
    values.length,
    (index) => {
      const value = rsi[index];
      const previousValue = rsi[index - 1];
      return isTradingViewNativeFiniteValue(value) &&
        isTradingViewNativeFiniteValue(previousValue)
        ? Math.abs(value - previousValue)
        : null;
    },
  );
  const bandPeriod = normalizedRsiPeriod * 2 - 1;
  const bandWidths = calculateTradingViewNativeExponentialMovingAverage(
    calculateTradingViewNativeExponentialMovingAverage(movements, bandPeriod),
    bandPeriod,
  );

  return {
    fast: calculateTrailingLine(rsi, bandWidths, fastFactor),
    rsi,
    slow: calculateTrailingLine(rsi, bandWidths, slowFactor),
  };
}
