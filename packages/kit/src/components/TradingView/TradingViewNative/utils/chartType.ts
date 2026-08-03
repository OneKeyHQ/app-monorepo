import type { IMarketKLinePointType } from '../../utils/fetchMarketKLineData';
import type { ITradingViewNativeChartType } from '../types';

export function getTradingViewNativeChartType({
  hasSingleValueHistory,
  pointCount,
}: {
  hasSingleValueHistory: boolean;
  pointCount: number;
}): ITradingViewNativeChartType {
  return hasSingleValueHistory || pointCount === 1 ? 'line' : 'candlestick';
}

export function isTradingViewNativeSingleValueHistory(
  pointType?: IMarketKLinePointType,
) {
  return pointType === 'single';
}
