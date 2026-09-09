import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

import {
  type ITradingViewNativeIndicatorSeries,
  getTradingViewNativeIndicatorPriceRange,
} from './chartIndicators';
import { getTradingViewNativePriceRange } from './chartViewport';
import { mergeTradingViewNativePriceRanges } from './priceScale';

import type { ITradingViewNativeChartType } from '../types';

export function getTradingViewNativeMainPriceRange({
  chartType,
  endIndex,
  indicatorSeries,
  points,
  startIndex,
}: {
  chartType: ITradingViewNativeChartType;
  endIndex: number;
  indicatorSeries: ITradingViewNativeIndicatorSeries[];
  points: IMarketTokenKLineDataPoint[];
  startIndex: number;
}) {
  'worklet';

  return mergeTradingViewNativePriceRanges({
    additionalPriceRange: getTradingViewNativeIndicatorPriceRange({
      endIndex,
      series: indicatorSeries,
      startIndex,
    }),
    priceRange: getTradingViewNativePriceRange({
      chartType,
      endIndex,
      points,
      startIndex,
    }),
  });
}
