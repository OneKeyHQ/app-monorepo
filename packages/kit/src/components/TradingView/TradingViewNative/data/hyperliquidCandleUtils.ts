import BigNumber from 'bignumber.js';

import type { ICandle } from '@onekeyhq/shared/types/hyperliquid/sdk';
import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

export type IHyperliquidCandleInterval = ICandle['i'];

const HYPERLIQUID_INTERVAL_BY_CHART_INTERVAL: Record<
  string,
  IHyperliquidCandleInterval
> = {
  '1': '1m',
  '5': '5m',
  '15': '15m',
  '30': '30m',
  '60': '1h',
  '240': '4h',
  '1D': '1d',
  '1W': '1w',
};

export function getHyperliquidCandleInterval(
  chartInterval: string,
): IHyperliquidCandleInterval {
  return HYPERLIQUID_INTERVAL_BY_CHART_INTERVAL[chartInterval] ?? '1m';
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
