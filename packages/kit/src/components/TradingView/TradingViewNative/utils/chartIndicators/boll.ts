// cspell:ignore Bollinger
import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

import { normalizeTradingViewNativeIndicatorPeriod } from './normalizePeriod';

import type { ITradingViewNativeIndicatorSeries } from './types';

const BOLL_PERIOD = 20;
const BOLL_STANDARD_DEVIATION_MULTIPLIER = 2;

export function calculateTradingViewNativeBollingerBands(
  values: readonly number[],
  period: number,
  standardDeviationMultiplier: number,
) {
  const normalizedPeriod = normalizeTradingViewNativeIndicatorPeriod(period);
  const normalizedMultiplier = Number.isFinite(standardDeviationMultiplier)
    ? Math.max(standardDeviationMultiplier, 0)
    : 0;
  const middle = Array<number | null>(values.length).fill(null);
  const upper = Array<number | null>(values.length).fill(null);
  const lower = Array<number | null>(values.length).fill(null);
  let sum = 0;
  let squaredSum = 0;
  let validValueCount = 0;

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (Number.isFinite(value)) {
      sum += value;
      squaredSum += value * value;
      validValueCount += 1;
    }

    const expiredIndex = index - normalizedPeriod;
    if (expiredIndex >= 0) {
      const expiredValue = values[expiredIndex];
      if (Number.isFinite(expiredValue)) {
        sum -= expiredValue;
        squaredSum -= expiredValue * expiredValue;
        validValueCount -= 1;
      }
    }

    if (index >= normalizedPeriod - 1 && validValueCount === normalizedPeriod) {
      const average = sum / normalizedPeriod;
      const variance = Math.max(
        squaredSum / normalizedPeriod - average * average,
        0,
      );
      const deviation = Math.sqrt(variance) * normalizedMultiplier;
      middle[index] = average;
      upper[index] = average + deviation;
      lower[index] = average - deviation;
    }
  }

  return { lower, middle, upper };
}

export function buildTradingViewNativeBollSeries(
  points: readonly IMarketTokenKLineDataPoint[],
): ITradingViewNativeIndicatorSeries[] {
  const bands = calculateTradingViewNativeBollingerBands(
    points.map((point) => point.c),
    BOLL_PERIOD,
    BOLL_STANDARD_DEVIATION_MULTIPLIER,
  );
  return [
    {
      indicator: 'BOLL',
      key: 'boll-middle',
      kind: 'line',
      paint: 'indicatorDarkOrangeStroke',
      values: bands.middle,
    },
    {
      indicator: 'BOLL',
      key: 'boll-upper',
      kind: 'line',
      paint: 'indicatorOrangeStroke',
      values: bands.upper,
    },
    {
      indicator: 'BOLL',
      key: 'boll-lower',
      kind: 'line',
      paint: 'indicatorOrangeStroke',
      values: bands.lower,
    },
  ];
}
