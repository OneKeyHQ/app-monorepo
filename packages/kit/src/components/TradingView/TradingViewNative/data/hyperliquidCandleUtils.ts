import BigNumber from 'bignumber.js';

import type { ICandle } from '@onekeyhq/shared/types/hyperliquid/sdk';
import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

export type IHyperliquidCandleInterval = ICandle['i'];

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
