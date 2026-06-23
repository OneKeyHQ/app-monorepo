import type { IMarketTokenChart } from '@onekeyhq/shared/types/market';
import type {
  IMarketTokenKLineDataPoint,
  IMarketTokenKLineResponse,
} from '@onekeyhq/shared/types/marketV2';

const SWAP_KLINE_WALLET_CHART_ONE_DAY_SECONDS = 24 * 60 * 60;

export function getSwapKLineWalletChartDays({
  timeFrom,
  timeTo,
  nowSeconds = Math.floor(Date.now() / 1000),
}: {
  timeFrom: number;
  timeTo: number;
  nowSeconds?: number;
}) {
  const requestEnd = Math.max(timeTo, nowSeconds);
  const timeSpan = Math.max(0, requestEnd - timeFrom);

  if (timeSpan <= SWAP_KLINE_WALLET_CHART_ONE_DAY_SECONDS) {
    return '1';
  }
  if (timeSpan <= 7 * SWAP_KLINE_WALLET_CHART_ONE_DAY_SECONDS) {
    return '7';
  }
  if (timeSpan <= 30 * SWAP_KLINE_WALLET_CHART_ONE_DAY_SECONDS) {
    return '30';
  }
  if (timeSpan <= 365 * SWAP_KLINE_WALLET_CHART_ONE_DAY_SECONDS) {
    return '365';
  }
  return 'max';
}

export function normalizeSwapKLineWalletChartTimestamp(timestamp: number) {
  if (timestamp > 10_000_000_000) {
    return Math.floor(timestamp / 1000);
  }
  return Math.floor(timestamp);
}

export function normalizeSwapKLineWalletChartData({
  chartData,
  timeFrom,
  timeTo,
}: {
  chartData?: IMarketTokenChart;
  timeFrom?: number;
  timeTo?: number;
}): IMarketTokenChart {
  const pointsByTimestamp = new Map<number, number>();

  for (const [timestamp, price] of chartData ?? []) {
    const normalizedTimestamp =
      normalizeSwapKLineWalletChartTimestamp(timestamp);
    const normalizedPrice = Number(price);

    if (
      Number.isFinite(normalizedTimestamp) &&
      Number.isFinite(normalizedPrice) &&
      (timeFrom === undefined || normalizedTimestamp >= timeFrom) &&
      (timeTo === undefined || normalizedTimestamp <= timeTo)
    ) {
      pointsByTimestamp.set(normalizedTimestamp, normalizedPrice);
    }
  }

  return Array.from(pointsByTimestamp.entries()).toSorted(
    (a, b) => a[0] - b[0],
  );
}

export function convertSwapKLineWalletChartToKLineResponse({
  chartData,
  timeFrom,
  timeTo,
}: {
  chartData?: IMarketTokenChart;
  timeFrom: number;
  timeTo: number;
}): IMarketTokenKLineResponse | null {
  const normalizedPoints = normalizeSwapKLineWalletChartData({
    chartData,
    timeFrom,
    timeTo,
  }).map(([timestamp, price]) => ({
    t: timestamp,
    c: price,
  }));

  if (!normalizedPoints.length) {
    return null;
  }

  const points = normalizedPoints.map<IMarketTokenKLineDataPoint>(
    (point, index) => {
      const open = index === 0 ? point.c : normalizedPoints[index - 1].c;
      return {
        o: open,
        h: Math.max(open, point.c),
        l: Math.min(open, point.c),
        c: point.c,
        v: 0,
        t: point.t,
      };
    },
  );

  return {
    points,
    total: points.length,
  };
}
