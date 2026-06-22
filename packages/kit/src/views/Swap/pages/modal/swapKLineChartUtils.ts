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

export function convertSwapKLineWalletChartToKLineResponse({
  chartData,
  timeFrom,
  timeTo,
}: {
  chartData?: IMarketTokenChart;
  timeFrom: number;
  timeTo: number;
}): IMarketTokenKLineResponse | null {
  const pointsByTimestamp = new Map<number, { t: number; c: number }>();

  for (const [timestamp, price] of chartData ?? []) {
    const point = {
      t: normalizeSwapKLineWalletChartTimestamp(timestamp),
      c: Number(price),
    };

    if (
      Number.isFinite(point.t) &&
      Number.isFinite(point.c) &&
      point.t >= timeFrom &&
      point.t <= timeTo
    ) {
      pointsByTimestamp.set(point.t, point);
    }
  }

  const normalizedPoints = Array.from(pointsByTimestamp.values()).toSorted(
    (a, b) => a.t - b.t,
  );

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
