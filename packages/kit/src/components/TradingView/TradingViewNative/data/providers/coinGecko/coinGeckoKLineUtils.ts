import type { IMarketTokenChart } from '@onekeyhq/shared/types/market';
import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

import type { ITradingViewNativeKLineInterval } from '../../tradingViewNativeIntervals';
import type { ITradingViewNativeHistoryResponse } from '../types';

const ONE_DAY_SECONDS = 24 * 60 * 60;
const COINGECKO_MAX_HISTORY_DAY_COUNT = 100 * 365;

export function getCoinGeckoChartDaysForInterval(
  interval: ITradingViewNativeKLineInterval,
) {
  switch (interval.value) {
    case '1':
    case '5':
    case '15':
    case '30':
      return '1';
    case '60':
    case '240':
      return '30';
    case '1D':
    case '1W':
      return 'max';
    default:
      return 'max';
  }
}

export function getCoinGeckoHistoryRequestCandleCount(
  interval: ITradingViewNativeKLineInterval,
) {
  const days = getCoinGeckoChartDaysForInterval(interval);
  const dayCount =
    days === 'max' ? COINGECKO_MAX_HISTORY_DAY_COUNT : Number(days);
  return Math.ceil((dayCount * ONE_DAY_SECONDS) / interval.seconds);
}

export function normalizeCoinGeckoChartTimestamp(timestamp: number) {
  if (timestamp > 10_000_000_000) {
    return Math.floor(timestamp / 1000);
  }
  return Math.floor(timestamp);
}

export function normalizeCoinGeckoChartData({
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
    const normalizedTimestamp = normalizeCoinGeckoChartTimestamp(timestamp);
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

export function convertCoinGeckoChartToKLineResponse({
  chartData,
  intervalSeconds,
  timeFrom,
  timeTo,
}: {
  chartData?: IMarketTokenChart;
  intervalSeconds?: number;
  timeFrom: number;
  timeTo: number;
}): ITradingViewNativeHistoryResponse | null {
  const normalizedChartData = normalizeCoinGeckoChartData({
    chartData,
    timeFrom,
    timeTo,
  });
  const normalizedIntervalSeconds =
    intervalSeconds && Number.isFinite(intervalSeconds)
      ? Math.max(Math.floor(intervalSeconds), 1)
      : undefined;
  if (!normalizedIntervalSeconds) {
    if (!normalizedChartData.length) {
      return null;
    }

    const points = normalizedChartData.map<IMarketTokenKLineDataPoint>(
      ([timestamp, price], index) => {
        const open = index === 0 ? price : normalizedChartData[index - 1][1];
        return {
          o: open,
          h: Math.max(open, price),
          l: Math.min(open, price),
          c: price,
          v: 0,
          t: timestamp,
        };
      },
    );
    return { pointType: 'single', points, total: points.length };
  }

  const pointsByTimestamp = new Map<number, IMarketTokenKLineDataPoint>();

  for (const [timestamp, price] of normalizedChartData) {
    const candleTimestamp =
      Math.floor(timestamp / normalizedIntervalSeconds) *
      normalizedIntervalSeconds;
    const existingPoint = pointsByTimestamp.get(candleTimestamp);
    if (existingPoint) {
      existingPoint.h = Math.max(existingPoint.h, price);
      existingPoint.l = Math.min(existingPoint.l, price);
      existingPoint.c = price;
    } else {
      pointsByTimestamp.set(candleTimestamp, {
        o: price,
        h: price,
        l: price,
        c: price,
        v: 0,
        t: candleTimestamp,
      });
    }
  }

  const points = Array.from(pointsByTimestamp.values());

  return {
    pointType: 'single',
    points,
    total: points.length,
  };
}
