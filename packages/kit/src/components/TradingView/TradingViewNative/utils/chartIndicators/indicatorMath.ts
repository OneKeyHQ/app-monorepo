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
