import BigNumber from 'bignumber.js';

import type { ICandle } from '@onekeyhq/shared/types/hyperliquid/sdk';
import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

export type IHyperliquidCandleInterval = ICandle['i'];

// Historical price rules from Hyperliquid's mainnet chart, https://app.hyperliquid.xyz (verified 2026-10-14).
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
  // Match Hyperliquid's boundary-day price correction; later candles are unchanged.
  return {
    ...point,
    o: Math.min(point.o, boundary.openingPriceCap),
    h: Math.min(point.h, boundary.openingPriceCap),
    l: Math.min(point.l, boundary.openingPriceCap),
    c: Math.min(point.c, boundary.openingPriceCap),
  };
}
