import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

import { normalizeTradingViewNativeIndicatorPeriod } from './normalizePeriod';

import type { ITradingViewNativeIndicatorValues } from './subIndicatorTypes';

export const TRADING_VIEW_NATIVE_INDICATOR_ZERO_EPSILON = 1e-10;

export function isTradingViewNativeFiniteValue(
  value: unknown,
): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function isTradingViewNativeIndicatorZero(value: number) {
  return Math.abs(value) <= TRADING_VIEW_NATIVE_INDICATOR_ZERO_EPSILON;
}

export function toTradingViewNativeFiniteValue(value: number) {
  return Number.isFinite(value) ? value : null;
}

export function getTradingViewNativeTypicalPrice(
  point: IMarketTokenKLineDataPoint | undefined,
) {
  if (
    !point ||
    !isTradingViewNativeFiniteValue(point.h) ||
    !isTradingViewNativeFiniteValue(point.l) ||
    !isTradingViewNativeFiniteValue(point.c)
  ) {
    return null;
  }

  return toTradingViewNativeFiniteValue((point.h + point.l + point.c) / 3);
}

export function getTradingViewNativePriceMidpoint(
  point: IMarketTokenKLineDataPoint | undefined,
) {
  if (
    !point ||
    !isTradingViewNativeFiniteValue(point.h) ||
    !isTradingViewNativeFiniteValue(point.l)
  ) {
    return null;
  }

  return toTradingViewNativeFiniteValue((point.h + point.l) / 2);
}

/**
 * Whether a bar's volume was reported. With `zeroVolumeIsMissing`, a zero
 * means "not reported" instead of "nothing traded": stock feeds send zero for
 * bars they have no volume for, such as after hours.
 */
export function hasTradingViewNativeReportedVolume(
  volume: unknown,
  zeroVolumeIsMissing: boolean,
): volume is number {
  return (
    isTradingViewNativeFiniteValue(volume) &&
    (!zeroVolumeIsMissing || volume > 0)
  );
}

/** Whether any bar traded at all. A source without volume sends only zeros. */
export function hasTradingViewNativeAnyVolume(
  points: readonly IMarketTokenKLineDataPoint[],
): boolean {
  return points.some(
    (point) => isTradingViewNativeFiniteValue(point?.v) && point.v > 0,
  );
}

export type ITradingViewNativePriceField = 'c' | 'h' | 'l' | 'o' | 'v';

export function getTradingViewNativePointValues(
  points: readonly IMarketTokenKLineDataPoint[],
  field: ITradingViewNativePriceField,
): ITradingViewNativeIndicatorValues {
  return points.map((point) => {
    const value = point?.[field];
    return isTradingViewNativeFiniteValue(value) ? value : null;
  });
}

/**
 * Builds a series from a per-bar formula. A formula that returns `null`,
 * `undefined` or a non-finite number leaves that bar empty.
 */
export function buildTradingViewNativeIndicatorValues(
  length: number,
  getValue: (index: number) => number | null | undefined,
): ITradingViewNativeIndicatorValues {
  const result: ITradingViewNativeIndicatorValues = Array(length).fill(null);
  for (let index = 0; index < length; index += 1) {
    const value = getValue(index);
    if (isTradingViewNativeFiniteValue(value)) {
      result[index] = value;
    }
  }
  return result;
}

/** True range of each bar. The first bar has no previous close, so it is empty. */
export function calculateTradingViewNativeTrueRange(
  points: readonly IMarketTokenKLineDataPoint[],
): ITradingViewNativeIndicatorValues {
  return buildTradingViewNativeIndicatorValues(points.length, (index) => {
    const point = points[index];
    const previousClose = points[index - 1]?.c;
    if (
      !point ||
      !isTradingViewNativeFiniteValue(point.h) ||
      !isTradingViewNativeFiniteValue(point.l) ||
      !isTradingViewNativeFiniteValue(previousClose)
    ) {
      return null;
    }
    return Math.max(
      point.h - point.l,
      Math.abs(point.h - previousClose),
      Math.abs(point.l - previousClose),
    );
  });
}

/**
 * Population standard deviation over a full window.
 *
 * The deviations are taken from the window's first value and then from their
 * own mean. Subtracting two large averages instead (`E[x^2] - E[x]^2`) loses
 * the small difference to rounding: a flat window would report a tiny
 * non-zero deviation, and a high price that barely moves a wrong one.
 */
export function calculateTradingViewNativeRollingStandardDeviation(
  values: readonly (number | null | undefined)[],
  period: number,
): ITradingViewNativeIndicatorValues {
  const normalizedPeriod = normalizeTradingViewNativeIndicatorPeriod(period);
  return buildTradingViewNativeIndicatorValues(values.length, (endIndex) => {
    if (endIndex < normalizedPeriod - 1) {
      return null;
    }
    const startIndex = endIndex - normalizedPeriod + 1;
    const origin = values[startIndex];
    if (!isTradingViewNativeFiniteValue(origin)) {
      return null;
    }
    let offsetSum = 0;
    for (let index = startIndex; index <= endIndex; index += 1) {
      const value = values[index];
      if (!isTradingViewNativeFiniteValue(value)) {
        return null;
      }
      offsetSum += value - origin;
    }
    const averageOffset = offsetSum / normalizedPeriod;
    let squaredDeviationSum = 0;
    for (let index = startIndex; index <= endIndex; index += 1) {
      const deviation = (values[index] ?? origin) - origin - averageOffset;
      squaredDeviationSum += deviation * deviation;
    }
    return Math.sqrt(squaredDeviationSum / normalizedPeriod);
  });
}

/** Value at the latest bar of the least-squares line fitted to a full window. */
export function calculateTradingViewNativeLinearRegression(
  values: readonly (number | null | undefined)[],
  period: number,
): ITradingViewNativeIndicatorValues {
  const normalizedPeriod = normalizeTradingViewNativeIndicatorPeriod(period);
  const averageOffset = (normalizedPeriod - 1) / 2;
  let offsetVariance = 0;
  for (let offset = 0; offset < normalizedPeriod; offset += 1) {
    offsetVariance += (offset - averageOffset) ** 2;
  }
  return buildTradingViewNativeIndicatorValues(values.length, (endIndex) => {
    if (endIndex < normalizedPeriod - 1) {
      return null;
    }
    let sum = 0;
    let covariance = 0;
    for (let offset = 0; offset < normalizedPeriod; offset += 1) {
      const value = values[endIndex - normalizedPeriod + 1 + offset];
      if (!isTradingViewNativeFiniteValue(value)) {
        return null;
      }
      sum += value;
      covariance += (offset - averageOffset) * value;
    }
    const average = sum / normalizedPeriod;
    if (offsetVariance === 0) {
      return average;
    }
    return average + (covariance / offsetVariance) * averageOffset;
  });
}

/** `100 * numerator / denominator` per bar; empty where the denominator is zero. */
export function calculateTradingViewNativePercentRatio(
  numerators: readonly (number | null | undefined)[],
  denominators: readonly (number | null | undefined)[],
): ITradingViewNativeIndicatorValues {
  return buildTradingViewNativeIndicatorValues(numerators.length, (index) => {
    const numerator = numerators[index];
    const denominator = denominators[index];
    return isTradingViewNativeFiniteValue(numerator) &&
      isTradingViewNativeFiniteValue(denominator) &&
      denominator !== 0
      ? (100 * numerator) / denominator
      : null;
  });
}

/** `left - right` per bar; empty where either side is. */
export function subtractTradingViewNativeIndicatorValues(
  left: readonly (number | null | undefined)[],
  right: readonly (number | null | undefined)[],
): ITradingViewNativeIndicatorValues {
  return buildTradingViewNativeIndicatorValues(left.length, (index) => {
    const leftValue = left[index];
    const rightValue = right[index];
    return isTradingViewNativeFiniteValue(leftValue) &&
      isTradingViewNativeFiniteValue(rightValue)
      ? leftValue - rightValue
      : null;
  });
}

export function calculateTradingViewNativeRollingSum(
  values: readonly (number | null | undefined)[],
  period: number,
): ITradingViewNativeIndicatorValues {
  const normalizedPeriod = normalizeTradingViewNativeIndicatorPeriod(period);
  const result: ITradingViewNativeIndicatorValues = Array(values.length).fill(
    null,
  );
  let sum = 0;
  let validValueCount = 0;

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (isTradingViewNativeFiniteValue(value)) {
      sum += value;
      validValueCount += 1;
    }

    const expiredIndex = index - normalizedPeriod;
    if (expiredIndex >= 0) {
      const expiredValue = values[expiredIndex];
      if (isTradingViewNativeFiniteValue(expiredValue)) {
        sum -= expiredValue;
        validValueCount -= 1;
      }
    }

    if (index >= normalizedPeriod - 1 && validValueCount === normalizedPeriod) {
      result[index] = toTradingViewNativeFiniteValue(sum);
    }
  }

  return result;
}

function calculateTradingViewNativeRollingExtreme(
  values: readonly (number | null | undefined)[],
  period: number,
  select: (current: number, candidate: number) => number,
): ITradingViewNativeIndicatorValues {
  const normalizedPeriod = normalizeTradingViewNativeIndicatorPeriod(period);
  const result: ITradingViewNativeIndicatorValues = Array(values.length).fill(
    null,
  );

  for (
    let endIndex = normalizedPeriod - 1;
    endIndex < values.length;
    endIndex += 1
  ) {
    let extreme: number | null = null;

    for (
      let index = endIndex - normalizedPeriod + 1;
      index <= endIndex;
      index += 1
    ) {
      const value = values[index];
      if (!isTradingViewNativeFiniteValue(value)) {
        extreme = null;
        break;
      }
      extreme = extreme === null ? value : select(extreme, value);
    }

    result[endIndex] = extreme;
  }

  return result;
}

export function calculateTradingViewNativeRollingHighest(
  values: readonly (number | null | undefined)[],
  period: number,
) {
  return calculateTradingViewNativeRollingExtreme(values, period, Math.max);
}

export function calculateTradingViewNativeRollingLowest(
  values: readonly (number | null | undefined)[],
  period: number,
) {
  return calculateTradingViewNativeRollingExtreme(values, period, Math.min);
}
