import type { IMarketKLinePointType } from '../../utils/fetchMarketKLineData';
import type { ITradingViewNativeChartType } from '../types';

export function getTradingViewNativeChartType({
  pointCount,
  pointType,
}: {
  pointCount: number;
  pointType?: IMarketKLinePointType;
}): ITradingViewNativeChartType {
  return pointType === 'single' || pointCount === 1 ? 'line' : 'candlestick';
}

export function mergeTradingViewNativePointTypes(
  ...pointTypes: (IMarketKLinePointType | undefined)[]
): IMarketKLinePointType {
  return pointTypes.includes('single') ? 'single' : 'ohlc';
}
