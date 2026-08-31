import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IMarketStockPublicChartPeriod } from '@onekeyhq/shared/types/marketV2';

import type { IMarketKLineDataResponse } from './fetchMarketKLineData';

const STOCK_PRO_CHART_POINT_COUNT = 299;
const HOUR_SECONDS = 60 * 60;
const DAY_SECONDS = 24 * HOUR_SECONDS;
const WEEK_SECONDS = 7 * DAY_SECONDS;
const YEAR_SECONDS = 365 * DAY_SECONDS;

export function getMarketStockChartPeriod({
  timeFrom,
  timeTo,
}: {
  timeFrom: number;
  timeTo: number;
}): IMarketStockPublicChartPeriod {
  const requiredLookback = Math.max(0, timeTo - timeFrom);
  if (requiredLookback <= HOUR_SECONDS) return '1h';
  if (requiredLookback <= DAY_SECONDS) return '1d';
  if (requiredLookback <= WEEK_SECONDS) return '1w';
  if (requiredLookback <= YEAR_SECONDS) return '1y';
  return 'all';
}

export async function fetchMarketStockKLineData({
  stockId,
  timeFrom,
  timeTo,
}: {
  stockId: string;
  timeFrom: number;
  timeTo: number;
}): Promise<IMarketKLineDataResponse> {
  const response =
    await backgroundApiProxy.serviceMarketV2.fetchMarketStockChart({
      stockId,
      period: getMarketStockChartPeriod({ timeFrom, timeTo }),
      points: STOCK_PRO_CHART_POINT_COUNT,
    });
  const points = response.points
    .filter(
      (point) =>
        Number.isFinite(point.t) && point.t >= timeFrom && point.t <= timeTo,
    )
    .toSorted((a, b) => a.t - b.t);

  return {
    pointType: 'ohlc',
    points,
    total: points.length,
  };
}
