import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

import {
  hasTradingViewNativeAnyVolume,
  hasTradingViewNativeReportedVolume,
  isTradingViewNativeFiniteValue,
} from './indicatorMath';

import type { ITradingViewNativeIndicatorValues } from './subIndicatorTypes';

export interface ITradingViewNativePvtOptions {
  /**
   * Read a zero volume as "not reported" instead of "nothing traded". Stock
   * charts get zero volume for bars their feed has no volume for.
   */
  zeroVolumeIsMissing?: boolean;
}

/**
 * Price volume trend: each bar adds its volume times its relative close
 * change to a running total that starts at zero.
 *
 * A bar without a close or a reported volume has no value. It is left out
 * entirely: the next bar measures its change from the last bar that had both
 * and continues from the last total. A source that reports no volume at all
 * has no trend.
 */
export function calculateTradingViewNativePriceVolumeTrend(
  points: readonly IMarketTokenKLineDataPoint[],
  { zeroVolumeIsMissing = false }: ITradingViewNativePvtOptions = {},
): ITradingViewNativeIndicatorValues {
  const result: ITradingViewNativeIndicatorValues = Array(points.length).fill(
    null,
  );
  if (!hasTradingViewNativeAnyVolume(points)) {
    return result;
  }

  let total = 0;
  let previousClose: number | null = null;
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    if (
      point &&
      isTradingViewNativeFiniteValue(point.c) &&
      hasTradingViewNativeReportedVolume(point.v, zeroVolumeIsMissing)
    ) {
      // A previous close of zero has no relative change to measure from.
      const hasChange = previousClose === null || previousClose !== 0;
      if (previousClose !== null && previousClose !== 0) {
        total += ((point.c - previousClose) / previousClose) * point.v;
      }
      if (!Number.isFinite(total)) {
        break;
      }
      if (hasChange) {
        result[index] = total;
      }
      previousClose = point.c;
    }
  }

  return result;
}
