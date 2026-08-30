// cspell:ignore MFI
import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

import {
  calculateTradingViewNativeRollingSum,
  getTradingViewNativeTypicalPrice,
  isTradingViewNativeFiniteValue,
  isTradingViewNativeIndicatorZero,
  toTradingViewNativeFiniteValue,
} from './indicatorMath';

import type { ITradingViewNativeIndicatorValues } from './subIndicatorTypes';

const DEFAULT_MFI_PERIOD = 14;

export function calculateTradingViewNativeMoneyFlowIndex(
  points: readonly IMarketTokenKLineDataPoint[],
  period = DEFAULT_MFI_PERIOD,
): ITradingViewNativeIndicatorValues {
  const typicalPrices = points.map(getTradingViewNativeTypicalPrice);
  const positiveFlows: ITradingViewNativeIndicatorValues = Array(
    points.length,
  ).fill(null);
  const negativeFlows: ITradingViewNativeIndicatorValues = Array(
    points.length,
  ).fill(null);

  for (let index = 1; index < points.length; index += 1) {
    const point = points[index];
    const typicalPrice = typicalPrices[index];
    const previousTypicalPrice = typicalPrices[index - 1];
    if (
      point &&
      isTradingViewNativeFiniteValue(point.v) &&
      isTradingViewNativeFiniteValue(typicalPrice) &&
      isTradingViewNativeFiniteValue(previousTypicalPrice)
    ) {
      const rawMoneyFlow = typicalPrice * point.v;
      if (isTradingViewNativeFiniteValue(rawMoneyFlow)) {
        positiveFlows[index] =
          typicalPrice > previousTypicalPrice ? rawMoneyFlow : 0;
        negativeFlows[index] =
          typicalPrice < previousTypicalPrice ? rawMoneyFlow : 0;
      }
    }
  }

  const positiveSums = calculateTradingViewNativeRollingSum(
    positiveFlows,
    period,
  );
  const negativeSums = calculateTradingViewNativeRollingSum(
    negativeFlows,
    period,
  );
  const result: ITradingViewNativeIndicatorValues = Array(points.length).fill(
    null,
  );

  for (let index = 0; index < points.length; index += 1) {
    const positiveSum = positiveSums[index];
    const negativeSum = negativeSums[index];
    if (
      isTradingViewNativeFiniteValue(positiveSum) &&
      isTradingViewNativeFiniteValue(negativeSum)
    ) {
      if (isTradingViewNativeIndicatorZero(negativeSum)) {
        result[index] = 100;
      } else if (isTradingViewNativeIndicatorZero(positiveSum)) {
        result[index] = 0;
      } else {
        const moneyRatio = positiveSum / negativeSum;
        result[index] = toTradingViewNativeFiniteValue(
          100 - 100 / (1 + moneyRatio),
        );
      }
    }
  }

  return result;
}
