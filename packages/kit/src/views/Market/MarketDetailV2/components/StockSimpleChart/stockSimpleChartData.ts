import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IMarketPriceSource } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
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

// Bucket size sent to the k-line API per range. 1D reads 5-minute candles: the
// coarser 15m bucket drew a visibly angular line next to the same range on a
// CEX chart, and 5m matches the resolution the share feed already returns.
const STOCK_TOKEN_CHART_INTERVALS: Record<IStockSimpleChartRange, string> = {
  '1H': '1m',
  '1D': '5m',
  '1W': '1H',
  '1M': '4H',
  '1Y': '1D',
  All: '1W',
};

type IStockShareChartRequest = {
  period: IMarketStockPublicChartPeriod;
  // Trailing window kept from the returned series, measured back from its last
  // point rather than from `now` so a closed market still shows the tail of the
  // most recent session instead of an empty chart.
  trailingSeconds?: number;
};

// The share endpoint only accepts 1h/1d/1w/1y/all, so two of the six ranges
// have no period of their own: 1M has no equivalent at all, and 1h currently
// fails server-side for every symbol. Both are cut from the next period up —
// 1H out of the 5-minute session series, 1M out of the daily year series — so
// the points still come from the share feed, just over a narrower window.
const STOCK_SHARE_CHART_REQUESTS: Record<
  IStockSimpleChartRange,
  IStockShareChartRequest
> = {
  '1H': {
    period: '1d',
    trailingSeconds: STOCK_SIMPLE_CHART_RANGE_SECONDS['1H'],
  },
  '1D': { period: '1d' },
  '1W': { period: '1w' },
  '1M': {
    period: '1y',
    trailingSeconds: STOCK_SIMPLE_CHART_RANGE_SECONDS['1M'],
  },
  '1Y': { period: '1y' },
  All: { period: 'all' },
};

// Server cap. The endpoint reduces the series to its own natural resolution
// below that cap, so asking for the cap means "give me everything you have".
const STOCK_SHARE_CHART_POINTS = 500;

function toLineChartPoints(
  points: { t: number; c: number }[],
): IMarketTokenChart {
  return points
    .map((point) => [Number(point.t), Number(point.c)] as [number, number])
    .filter(
      ([timestamp, price]) =>
        Number.isFinite(timestamp) && Number.isFinite(price),
    )
    .toSorted((a, b) => a[0] - b[0]);
}

function trimTrailingWindow(
  data: IMarketTokenChart,
  trailingSeconds: number | undefined,
): IMarketTokenChart {
  if (!trailingSeconds || !data.length) {
    return data;
  }
  const lastTimestamp = data[data.length - 1][0];
  const trimmed = data.filter(
    ([timestamp]) => timestamp >= lastTimestamp - trailingSeconds,
  );
  // A window that lands on a single point draws nothing — a coarser chart beats
  // a blank one, so fall back to the untrimmed series.
  return trimmed.length >= 2 ? trimmed : data;
}

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
  priceMode: IMarketPriceSource;
  range: IStockSimpleChartRange;
  stockId?: string;
  tokenAddress: string;
}): Promise<IMarketTokenChart> {
  // The header and the chart must plot the same series: share price reads the
  // underlying listing, token price reads the wrapped token's k-line.
  const isSharePrice = priceMode === 'share';
  if (isSharePrice) {
    if (!stockId) {
      return [];
    }
    const { period, trailingSeconds } = STOCK_SHARE_CHART_REQUESTS[range];
    const response =
      await backgroundApiProxy.serviceMarketV2.fetchMarketStockChart({
        stockId,
        period,
        points: STOCK_SHARE_CHART_POINTS,
      });
    return trimTrailingWindow(
      toLineChartPoints(response?.points ?? []),
      trailingSeconds,
    );
  }

  if (!networkId || (!tokenAddress && !isNative)) {
    return [];
  }

  const rangeSeconds = STOCK_SIMPLE_CHART_RANGE_SECONDS[range];
  const timeTo = Math.floor(Date.now() / 1000);
  const timeFrom = rangeSeconds ? timeTo - rangeSeconds : undefined;
  const response =
    await backgroundApiProxy.serviceMarketV2.fetchMarketTokenKline({
      interval: STOCK_TOKEN_CHART_INTERVALS[range],
      networkId,
      tokenAddress,
      timeFrom,
      timeTo,
      autoHandleError: false,
    });

  return toLineChartPoints(response.points);
}
