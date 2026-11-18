import BigNumber from 'bignumber.js';

import type { ICandle } from '@onekeyhq/shared/types/hyperliquid/sdk';
import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

export type IHyperliquidCandleInterval = ICandle['i'];
export type IHyperliquidCalendarInterval = '1w' | '1M';

export const HYPERLIQUID_DAY_SECONDS = 24 * 60 * 60;

// Historical price rules from Hyperliquid's mainnet chart, verified 2026-10-09.
const MAINNET_HISTORY_BOUNDARIES = new Map([
  ['@142', { startTime: 1_739_556_000_000, openingPriceCap: 98_998 }],
  ['@151', { startTime: 1_743_085_980_000, openingPriceCap: 2021 }],
]);

export function getHyperliquidCandleHistoryBoundary(
  coin: string,
  environment: string,
) {
  return environment === 'mainnet'
    ? MAINNET_HISTORY_BOUNDARIES.get(coin)
    : undefined;
}

export function isHyperliquidCalendarInterval(
  interval: IHyperliquidCandleInterval,
): interval is IHyperliquidCalendarInterval {
  return interval === '1w' || interval === '1M';
}

export function getHyperliquidCalendarBucketStart(
  timestamp: number,
  interval: IHyperliquidCalendarInterval,
) {
  const date = new Date(timestamp * 1000);
  date.setUTCHours(0, 0, 0, 0);
  if (interval === '1M') {
    date.setUTCDate(1);
  } else {
    date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  }
  return date.getTime() / 1000;
}

export function getHyperliquidCalendarBucketEnd(
  timestamp: number,
  interval: IHyperliquidCalendarInterval,
) {
  const date = new Date(
    getHyperliquidCalendarBucketStart(timestamp, interval) * 1000,
  );
  if (interval === '1M') {
    date.setUTCMonth(date.getUTCMonth() + 1);
  } else {
    date.setUTCDate(date.getUTCDate() + 7);
  }
  return date.getTime() / 1000 - 1;
}

export function aggregateHyperliquidCalendarCandles(
  points: IMarketTokenKLineDataPoint[],
  interval: IHyperliquidCalendarInterval,
) {
  const days = new Map(points.map((point) => [point.t, point]));
  const candles = new Map<number, IMarketTokenKLineDataPoint>();
  Array.from(days.values())
    .toSorted((a, b) => a.t - b.t)
    .forEach((point) => {
      const timestamp = getHyperliquidCalendarBucketStart(point.t, interval);
      const previous = candles.get(timestamp);
      candles.set(
        timestamp,
        previous
          ? {
              ...previous,
              h: Math.max(previous.h, point.h),
              l: Math.min(previous.l, point.l),
              c: point.c,
              v: previous.v + point.v,
            }
          : { ...point, t: timestamp },
      );
    });
  return Array.from(candles.values());
}

function toFiniteNumber(value: string) {
  const number = new BigNumber(value);
  return number.isFinite() ? number.toNumber() : Number.NaN;
}

export function normalizeHyperliquidCandle(
  candle: ICandle,
): IMarketTokenKLineDataPoint | null {
  const point = {
    o: toFiniteNumber(candle.o),
    h: toFiniteNumber(candle.h),
    l: toFiniteNumber(candle.l),
    c: toFiniteNumber(candle.c),
    v: toFiniteNumber(candle.v),
    t: Math.floor(candle.t / 1000),
  };

  return Number.isFinite(point.o) &&
    Number.isFinite(point.h) &&
    Number.isFinite(point.l) &&
    Number.isFinite(point.c) &&
    Number.isFinite(point.v) &&
    Number.isFinite(point.t) &&
    point.h >= point.l
    ? point
    : null;
}

export function normalizeHyperliquidHistoryCandle(
  candle: ICandle,
  environment: string,
): IMarketTokenKLineDataPoint | null {
  const boundary = getHyperliquidCandleHistoryBoundary(candle.s, environment);
  if (boundary && candle.T < boundary.startTime) {
    return null;
  }
  const point = normalizeHyperliquidCandle(candle);
  if (!point || !boundary || candle.t >= boundary.startTime) {
    return point;
  }
  // The boundary day is retained by Hyperliquid with its pre-boundary
  // prices capped consistently to preserve valid candle prices. Later candles are unchanged.
  return {
    ...point,
    o: Math.min(point.o, boundary.openingPriceCap),
    h: Math.min(point.h, boundary.openingPriceCap),
    l: Math.min(point.l, boundary.openingPriceCap),
    c: Math.min(point.c, boundary.openingPriceCap),
  };
}
