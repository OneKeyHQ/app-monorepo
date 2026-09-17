import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IMarketStockPublicChartInterval } from '@onekeyhq/shared/types/marketV2';

import type { IMarketKLineDataResponse } from './fetchMarketKLineData';

const STOCK_CHART_INTERVALS: Record<string, IMarketStockPublicChartInterval> = {
  '1': '1min',
  '1m': '1min',
  '5': '5min',
  '5m': '5min',
  '15': '15min',
  '15m': '15min',
  '30': '30min',
  '30m': '30min',
  '60': '1hour',
  '1H': '1hour',
  '240': '4hour',
  '4H': '4hour',
  '1D': '1day',
  // Boundary discovery uses weekly candles even when the selector hides them.
  '1W': '1week',
  '1M': '1month',
};

export function getMarketStockChartInterval(
  interval: string,
): IMarketStockPublicChartInterval {
  const chartInterval = STOCK_CHART_INTERVALS[interval];
  if (!chartInterval) {
    throw new OneKeyLocalError(`Invalid stock K-line interval: ${interval}`);
  }
  return chartInterval;
}

export async function fetchMarketStockKLineData({
  interval,
  stockId,
  timeFrom,
  timeTo,
}: {
  interval: string;
  stockId: string;
  timeFrom: number;
  timeTo: number;
}): Promise<IMarketKLineDataResponse> {
  const response =
    await backgroundApiProxy.serviceMarketV2.fetchMarketStockChart({
      stockId,
      interval: getMarketStockChartInterval(interval),
      from: timeFrom,
      to: timeTo,
    });
  const points = response.points
    .filter(
      (point) =>
        Number.isFinite(point.t) && point.t >= timeFrom && point.t <= timeTo,
    )
    .toSorted((a, b) => a.t - b.t);
  return { pointType: 'ohlc', points, total: points.length };
}
