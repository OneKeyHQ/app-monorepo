import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

import {
  buildTradingViewNativeIndicatorValues,
  isTradingViewNativeFiniteValue,
} from './indicatorMath';

import type { ITradingViewNativeIndicatorValues } from './subIndicatorTypes';

/**
 * Price volume trend: each bar adds its volume times its relative close
 * change to a running total that starts at zero. A bar that cannot be
 * calculated is left empty and the total carries on from the bar before it.
 */
export function calculateTradingViewNativePriceVolumeTrend(
  points: readonly IMarketTokenKLineDataPoint[],
): ITradingViewNativeIndicatorValues {
  let total = 0;
  return buildTradingViewNativeIndicatorValues(points.length, (index) => {
    const close = points[index]?.c;
    const volume = points[index]?.v;
    if (
      !isTradingViewNativeFiniteValue(close) ||
      !isTradingViewNativeFiniteValue(volume)
    ) {
      return null;
    }
    if (index === 0) {
      return total;
    }
    const previousClose = points[index - 1]?.c;
    if (!isTradingViewNativeFiniteValue(previousClose) || previousClose === 0) {
      return null;
    }
    total += ((close - previousClose) / previousClose) * volume;
    return total;
  });
}
