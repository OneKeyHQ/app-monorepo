// cspell:ignore CCI
import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

import {
  getTradingViewNativeTypicalPrice,
  isTradingViewNativeFiniteValue,
  toTradingViewNativeFiniteValue,
} from './indicatorMath';
import { calculateTradingViewNativeSimpleMovingAverage } from './ma';
import { normalizeTradingViewNativeIndicatorPeriod } from './normalizePeriod';

import type { ITradingViewNativeIndicatorValues } from './subIndicatorTypes';

const DEFAULT_CCI_PERIOD = 20;
const DEFAULT_CCI_MOVING_AVERAGE_PERIOD = 20;
const CCI_MEAN_DEVIATION_MULTIPLIER = 0.015;

export interface ITradingViewNativeCciOptions {
  movingAveragePeriod?: number;
  period?: number;
}

export interface ITradingViewNativeCciResult {
  cci: ITradingViewNativeIndicatorValues;
  movingAverage: ITradingViewNativeIndicatorValues;
}

export function calculateTradingViewNativeCommodityChannelIndex(
  points: readonly IMarketTokenKLineDataPoint[],
  {
    movingAveragePeriod = DEFAULT_CCI_MOVING_AVERAGE_PERIOD,
    period = DEFAULT_CCI_PERIOD,
  }: ITradingViewNativeCciOptions = {},
): ITradingViewNativeCciResult {
  const normalizedPeriod = normalizeTradingViewNativeIndicatorPeriod(period);
  const typicalPrices = points.map(getTradingViewNativeTypicalPrice);
  const bases = calculateTradingViewNativeSimpleMovingAverage(
    typicalPrices,
    normalizedPeriod,
  );
  const cci: ITradingViewNativeIndicatorValues = Array(points.length).fill(
    null,
  );

  for (
    let endIndex = normalizedPeriod - 1;
    endIndex < points.length;
    endIndex += 1
  ) {
    const typicalPrice = typicalPrices[endIndex];
    const basis = bases[endIndex];
    if (
      isTradingViewNativeFiniteValue(typicalPrice) &&
      isTradingViewNativeFiniteValue(basis)
    ) {
      let absoluteDeviationSum = 0;
      let hasCompleteWindow = true;
      for (
        let index = endIndex - normalizedPeriod + 1;
        index <= endIndex;
        index += 1
      ) {
        const windowTypicalPrice = typicalPrices[index];
        if (!isTradingViewNativeFiniteValue(windowTypicalPrice)) {
          hasCompleteWindow = false;
          break;
        }
        absoluteDeviationSum += Math.abs(windowTypicalPrice - basis);
      }

      const meanDeviation = absoluteDeviationSum / normalizedPeriod;
      if (
        hasCompleteWindow &&
        isTradingViewNativeFiniteValue(meanDeviation) &&
        meanDeviation !== 0
      ) {
        cci[endIndex] = toTradingViewNativeFiniteValue(
          (typicalPrice - basis) /
            (CCI_MEAN_DEVIATION_MULTIPLIER * meanDeviation),
        );
      }
    }
  }

  return {
    cci,
    movingAverage: calculateTradingViewNativeSimpleMovingAverage(
      cci,
      movingAveragePeriod,
    ),
  };
}
