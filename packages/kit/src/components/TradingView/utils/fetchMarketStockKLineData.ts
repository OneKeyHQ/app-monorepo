import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type {
  IMarketStockPublicChartPeriod,
  IMarketStockPublicChartPoint,
} from '@onekeyhq/shared/types/marketV2';

import type { IMarketKLineDataResponse } from './fetchMarketKLineData';

const STOCK_PRO_CHART_MAX_SOURCE_POINT_COUNT = 500;
const MINUTE_SECONDS = 60;
const HOUR_SECONDS = 60 * MINUTE_SECONDS;
const DAY_SECONDS = 24 * HOUR_SECONDS;
const WEEK_SECONDS = 7 * DAY_SECONDS;
const UNIX_EPOCH_MONDAY_OFFSET_DAYS = 4;

type IMarketStockKLineIntervalUnit =
  | 'minute'
  | 'hour'
  | 'day'
  | 'week'
  | 'month'
  | 'year';

interface IMarketStockKLineInterval {
  count: number;
  seconds?: number;
  unit: IMarketStockKLineIntervalUnit;
}

const STOCK_CHART_SOURCES: {
  period: IMarketStockPublicChartPeriod;
  resolutionSeconds: number;
}[] = [
  { period: '1y', resolutionSeconds: DAY_SECONDS },
  { period: '1w', resolutionSeconds: 30 * MINUTE_SECONDS },
  { period: '1d', resolutionSeconds: 5 * MINUTE_SECONDS },
  { period: '1h', resolutionSeconds: MINUTE_SECONDS },
];

function parseMarketStockKLineInterval(
  interval: string,
): IMarketStockKLineInterval {
  const normalizedInterval = interval.trim();
  const match = normalizedInterval.match(/^(\d+)([a-zA-Z])$/);
  const bareMinuteMatch = normalizedInterval.match(/^\d+$/);
  const count = Number(match?.[1] ?? bareMinuteMatch?.[0]);
  const rawUnit = match?.[2] ?? 'm';

  if (!Number.isSafeInteger(count) || count <= 0) {
    throw new OneKeyLocalError(`Invalid stock K-line interval: ${interval}`);
  }

  if (rawUnit === 'm') {
    return { count, seconds: count * MINUTE_SECONDS, unit: 'minute' };
  }
  if (rawUnit === 'h' || rawUnit === 'H') {
    return { count, seconds: count * HOUR_SECONDS, unit: 'hour' };
  }
  if (rawUnit === 'd' || rawUnit === 'D') {
    return { count, seconds: count * DAY_SECONDS, unit: 'day' };
  }
  if (rawUnit === 'w' || rawUnit === 'W') {
    return { count, seconds: count * WEEK_SECONDS, unit: 'week' };
  }
  if (rawUnit === 'M') {
    return { count, unit: 'month' };
  }
  if (rawUnit === 'y' || rawUnit === 'Y') {
    return { count, unit: 'year' };
  }

  throw new OneKeyLocalError(`Invalid stock K-line interval: ${interval}`);
}

export function getMarketStockChartPeriod({
  interval,
}: {
  interval: string;
}): IMarketStockPublicChartPeriod {
  const parsedInterval = parseMarketStockKLineInterval(interval);
  if (!parsedInterval.seconds) {
    return '1y';
  }

  return (
    STOCK_CHART_SOURCES.find(
      ({ resolutionSeconds }) =>
        parsedInterval.seconds !== undefined &&
        parsedInterval.seconds >= resolutionSeconds &&
        parsedInterval.seconds % resolutionSeconds === 0,
    )?.period ?? '1h'
  );
}

function getCalendarBucketTimestamp({
  interval,
  timestamp,
}: {
  interval: IMarketStockKLineInterval;
  timestamp: number;
}) {
  const date = new Date(timestamp * 1000);
  if (interval.unit === 'month') {
    const monthIndex = date.getUTCFullYear() * 12 + date.getUTCMonth();
    const bucketMonthIndex =
      Math.floor(monthIndex / interval.count) * interval.count;
    return (
      Date.UTC(Math.floor(bucketMonthIndex / 12), bucketMonthIndex % 12, 1) /
      1000
    );
  }
  if (interval.unit === 'year') {
    const bucketYear =
      Math.floor(date.getUTCFullYear() / interval.count) * interval.count;
    return Date.UTC(bucketYear, 0, 1) / 1000;
  }

  const dayIndex = Math.floor(timestamp / DAY_SECONDS);
  if (interval.unit === 'week') {
    const weekIndex = Math.floor(
      (dayIndex - UNIX_EPOCH_MONDAY_OFFSET_DAYS) / (interval.count * 7),
    );
    return (
      (UNIX_EPOCH_MONDAY_OFFSET_DAYS + weekIndex * interval.count * 7) *
      DAY_SECONDS
    );
  }

  return Math.floor(dayIndex / interval.count) * interval.count * DAY_SECONDS;
}

function aggregateMarketStockChartPoints({
  interval,
  points,
}: {
  interval: string;
  points: IMarketStockPublicChartPoint[];
}) {
  const parsedInterval = parseMarketStockKLineInterval(interval);
  const sortedPoints = points
    .filter((point) => Number.isFinite(point.t))
    .toSorted((a, b) => a.t - b.t);
  const sessionStartByUtcDay = new Map<number, number>();
  const usesSessionBuckets =
    parsedInterval.unit === 'minute' || parsedInterval.unit === 'hour';

  if (usesSessionBuckets) {
    for (const point of sortedPoints) {
      const utcDay = Math.floor(point.t / DAY_SECONDS);
      if (!sessionStartByUtcDay.has(utcDay)) {
        sessionStartByUtcDay.set(utcDay, point.t);
      }
    }
  }

  const pointsByTimestamp = new Map<number, IMarketStockPublicChartPoint>();
  for (const point of sortedPoints) {
    let timestamp: number;
    if (usesSessionBuckets && parsedInterval.seconds) {
      const utcDay = Math.floor(point.t / DAY_SECONDS);
      const sessionStart = sessionStartByUtcDay.get(utcDay) ?? point.t;
      timestamp =
        sessionStart +
        Math.floor((point.t - sessionStart) / parsedInterval.seconds) *
          parsedInterval.seconds;
    } else {
      timestamp = getCalendarBucketTimestamp({
        interval: parsedInterval,
        timestamp: point.t,
      });
    }

    const existingPoint = pointsByTimestamp.get(timestamp);
    if (existingPoint) {
      existingPoint.h = Math.max(existingPoint.h, point.h);
      existingPoint.l = Math.min(existingPoint.l, point.l);
      existingPoint.c = point.c;
      existingPoint.v += point.v;
    } else {
      pointsByTimestamp.set(timestamp, { ...point, t: timestamp });
    }
  }

  return Array.from(pointsByTimestamp.values());
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
      period: getMarketStockChartPeriod({ interval }),
      points: STOCK_PRO_CHART_MAX_SOURCE_POINT_COUNT,
    });
  const points = aggregateMarketStockChartPoints({
    interval,
    points: response.points,
  }).filter((point) => point.t >= timeFrom && point.t <= timeTo);

  return {
    pointType: 'ohlc',
    points,
    total: points.length,
  };
}
