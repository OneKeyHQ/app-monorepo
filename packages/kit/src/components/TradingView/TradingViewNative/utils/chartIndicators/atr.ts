// cspell:ignore Wilder
import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

import { calculateTradingViewNativeTrueRange } from './indicatorMath';
import { calculateTradingViewNativeWilderMovingAverage } from './rma';

import type { ITradingViewNativeIndicatorValues } from './subIndicatorTypes';

const DEFAULT_ATR_PERIOD = 14;

/** Average true range: Wilder's moving average of the true range. */
export function calculateTradingViewNativeAverageTrueRange(
  points: readonly IMarketTokenKLineDataPoint[],
  period = DEFAULT_ATR_PERIOD,
): ITradingViewNativeIndicatorValues {
  return calculateTradingViewNativeWilderMovingAverage(
    calculateTradingViewNativeTrueRange(points),
    period,
  );
}
