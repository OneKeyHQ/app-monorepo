// cspell:ignore ADXR DMI
import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

import {
  isTradingViewNativeFiniteValue,
  toTradingViewNativeFiniteValue,
} from './indicatorMath';
import { normalizeTradingViewNativeIndicatorPeriod } from './normalizePeriod';
import { calculateTradingViewNativeWilderMovingAverage } from './rma';

import type { ITradingViewNativeIndicatorValues } from './subIndicatorTypes';

const DEFAULT_DMI_DI_PERIOD = 14;
const DEFAULT_DMI_ADX_SMOOTHING_PERIOD = 14;

export interface ITradingViewNativeDmiOptions {
  adxSmoothingPeriod?: number;
  diPeriod?: number;
}

export interface ITradingViewNativeDmiResult {
  adx: ITradingViewNativeIndicatorValues;
  adxr: ITradingViewNativeIndicatorValues;
  dx: ITradingViewNativeIndicatorValues;
  minusDi: ITradingViewNativeIndicatorValues;
  plusDi: ITradingViewNativeIndicatorValues;
}

function isValidDirectionalMovementPoint(
  point: IMarketTokenKLineDataPoint | undefined,
): point is IMarketTokenKLineDataPoint {
  return Boolean(
    point &&
    isTradingViewNativeFiniteValue(point.c) &&
    isTradingViewNativeFiniteValue(point.h) &&
    isTradingViewNativeFiniteValue(point.l),
  );
}

export function calculateTradingViewNativeDirectionalMovementIndex(
  points: readonly IMarketTokenKLineDataPoint[],
  {
    adxSmoothingPeriod = DEFAULT_DMI_ADX_SMOOTHING_PERIOD,
    diPeriod = DEFAULT_DMI_DI_PERIOD,
  }: ITradingViewNativeDmiOptions = {},
): ITradingViewNativeDmiResult {
  const normalizedDiPeriod =
    normalizeTradingViewNativeIndicatorPeriod(diPeriod);
  const trueRanges: ITradingViewNativeIndicatorValues = Array(
    points.length,
  ).fill(null);
  const plusDirectionalMovements: ITradingViewNativeIndicatorValues = Array(
    points.length,
  ).fill(null);
  const minusDirectionalMovements: ITradingViewNativeIndicatorValues = Array(
    points.length,
  ).fill(null);

  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    if (isValidDirectionalMovementPoint(point)) {
      const previousPoint = points[index - 1];
      if (isValidDirectionalMovementPoint(previousPoint)) {
        const upMove = point.h - previousPoint.h;
        const downMove = previousPoint.l - point.l;
        plusDirectionalMovements[index] =
          upMove > downMove && upMove > 0 ? upMove : 0;
        minusDirectionalMovements[index] =
          downMove > upMove && downMove > 0 ? downMove : 0;
        trueRanges[index] = Math.max(
          point.h - point.l,
          Math.abs(point.h - previousPoint.c),
          Math.abs(point.l - previousPoint.c),
        );
      }
    }
  }

  const averageTrueRanges = calculateTradingViewNativeWilderMovingAverage(
    trueRanges,
    normalizedDiPeriod,
  );
  const averagePlusDirectionalMovements =
    calculateTradingViewNativeWilderMovingAverage(
      plusDirectionalMovements,
      normalizedDiPeriod,
    );
  const averageMinusDirectionalMovements =
    calculateTradingViewNativeWilderMovingAverage(
      minusDirectionalMovements,
      normalizedDiPeriod,
    );
  const plusDi: ITradingViewNativeIndicatorValues = Array(points.length).fill(
    null,
  );
  const minusDi: ITradingViewNativeIndicatorValues = Array(points.length).fill(
    null,
  );
  let previousPlusDi: number | null = null;
  let previousMinusDi: number | null = null;

  for (let index = 0; index < points.length; index += 1) {
    if (trueRanges[index] === null) {
      previousPlusDi = null;
      previousMinusDi = null;
    } else {
      const averageTrueRange = averageTrueRanges[index];
      const averagePlusDirectionalMovement =
        averagePlusDirectionalMovements[index];
      const averageMinusDirectionalMovement =
        averageMinusDirectionalMovements[index];
      if (
        isTradingViewNativeFiniteValue(averageTrueRange) &&
        isTradingViewNativeFiniteValue(averagePlusDirectionalMovement) &&
        isTradingViewNativeFiniteValue(averageMinusDirectionalMovement)
      ) {
        const nextPlusDi = toTradingViewNativeFiniteValue(
          (100 * averagePlusDirectionalMovement) / averageTrueRange,
        );
        const nextMinusDi = toTradingViewNativeFiniteValue(
          (100 * averageMinusDirectionalMovement) / averageTrueRange,
        );
        if (nextPlusDi !== null) {
          previousPlusDi = nextPlusDi;
        }
        if (nextMinusDi !== null) {
          previousMinusDi = nextMinusDi;
        }

        plusDi[index] = previousPlusDi;
        minusDi[index] = previousMinusDi;
      }
    }
  }

  const dx: ITradingViewNativeIndicatorValues = Array(points.length).fill(null);
  for (let index = 0; index < points.length; index += 1) {
    const plusDiValue = plusDi[index];
    const minusDiValue = minusDi[index];
    if (
      isTradingViewNativeFiniteValue(plusDiValue) &&
      isTradingViewNativeFiniteValue(minusDiValue)
    ) {
      const sum = plusDiValue + minusDiValue;
      dx[index] =
        sum === 0
          ? 0
          : toTradingViewNativeFiniteValue(
              (100 * Math.abs(plusDiValue - minusDiValue)) / sum,
            );
    }
  }

  const adx = calculateTradingViewNativeWilderMovingAverage(
    dx,
    adxSmoothingPeriod,
  );
  const adxr: ITradingViewNativeIndicatorValues = Array(points.length).fill(
    null,
  );
  const adxrOffset = normalizedDiPeriod - 1;

  for (let index = adxrOffset; index < points.length; index += 1) {
    const currentAdx = adx[index];
    const previousAdx = adx[index - adxrOffset];
    if (
      isTradingViewNativeFiniteValue(currentAdx) &&
      isTradingViewNativeFiniteValue(previousAdx)
    ) {
      adxr[index] = toTradingViewNativeFiniteValue(
        (currentAdx + previousAdx) / 2,
      );
    }
  }

  return { adx, adxr, dx, minusDi, plusDi };
}
