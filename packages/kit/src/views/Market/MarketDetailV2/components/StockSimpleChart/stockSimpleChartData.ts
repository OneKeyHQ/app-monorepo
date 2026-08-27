import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IMarketTokenChart } from '@onekeyhq/shared/types/market';
import type { IMarketStockPublicChartPeriod } from '@onekeyhq/shared/types/marketV2';

export type IStockSimpleChartRange = '1H' | '1D' | '1W' | '1M' | '1Y' | 'All';

const STOCK_SIMPLE_CHART_RANGE_SECONDS: Record<
  IStockSimpleChartRange,
  number | undefined
> = {
  '1H': 60 * 60,
  '1D': 24 * 60 * 60,
  '1W': 7 * 24 * 60 * 60,
  '1M': 30 * 24 * 60 * 60,
  '1Y': 365 * 24 * 60 * 60,
  All: undefined,
};

const STOCK_TOKEN_CHART_INTERVALS: Record<IStockSimpleChartRange, string> = {
  '1H': '1m',
  '1D': '15m',
  '1W': '1H',
  '1M': '4H',
  '1Y': '1D',
  All: '1W',
};

const STOCK_SHARE_CHART_PERIODS: Record<
  IStockSimpleChartRange,
  IMarketStockPublicChartPeriod
> = {
  '1H': '1h',
  '1D': '1d',
  '1W': '1w',
  '1M': '1y',
  '1Y': '1y',
  All: 'all',
};

export async function fetchStockSimpleChartPoints({
  isNative,
  networkId,
  priceMode,
  range,
  stockId,
  tokenAddress,
}: {
  isNative: boolean;
  networkId: string;
  priceMode: 'share' | 'token';
  range: IStockSimpleChartRange;
  stockId?: string;
  tokenAddress: string;
}): Promise<IMarketTokenChart> {
  const isSharePrice = priceMode === 'share';
  if (isSharePrice && !stockId) {
    return [];
  }
  if (!isSharePrice && (!networkId || (!tokenAddress && !isNative))) {
    return [];
  }

  const rangeSeconds = STOCK_SIMPLE_CHART_RANGE_SECONDS[range];
  const timeTo = Math.floor(Date.now() / 1000);
  const timeFrom = rangeSeconds ? timeTo - rangeSeconds : undefined;
  let response;
  if (isSharePrice) {
    if (!stockId) {
      return [];
    }
    response = await backgroundApiProxy.serviceMarketV2.fetchMarketStockChart({
      stockId,
      period: STOCK_SHARE_CHART_PERIODS[range],
      points: range === '1M' ? 180 : 100,
    });
  } else {
    response = await backgroundApiProxy.serviceMarketV2.fetchMarketTokenKline({
      interval: STOCK_TOKEN_CHART_INTERVALS[range],
      networkId,
      tokenAddress,
      timeFrom,
      timeTo,
      autoHandleError: false,
    });
  }

  return response.points
    .map((point) => [Number(point.t), Number(point.c)] as [number, number])
    .filter(([timestamp, price]) => {
      const isValidPoint = Number.isFinite(timestamp) && Number.isFinite(price);
      return (
        isValidPoint && (!isSharePrice || !timeFrom || timestamp >= timeFrom)
      );
    })
    .toSorted((a, b) => a[0] - b[0]);
}
