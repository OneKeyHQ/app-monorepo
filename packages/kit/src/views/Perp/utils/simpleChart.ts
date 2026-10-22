import BigNumber from 'bignumber.js';

import type { IHyperliquidCandleInterval } from '@onekeyhq/kit/src/components/TradingView/TradingViewNative/data/providers/hyperliquid/hyperliquidCandleUtils';
import type { IMobileSimpleChartRange } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/layouts/MobileSimpleChart';
import type { IMarketTokenChart } from '@onekeyhq/shared/types/market';
import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

const DAY_SECONDS = 24 * 60 * 60;
export type ISimpleChartPerformance = {
  coin: string;
  range: IMobileSimpleChartRange;
  change?: string;
  changePercent?: number;
};

export function getSimpleChartPerformance(data: IMarketTokenChart) {
  if (data.length < 2) return undefined;
  const first = new BigNumber(data[0][1]);
  const last = new BigNumber(data[data.length - 1][1]);
  if (!first.isFinite() || !last.isFinite() || first.lte(0) || last.lte(0)) {
    return undefined;
  }
  const change = last.minus(first);
  return {
    change: change.toFixed(),
    changePercent: change.dividedBy(first).multipliedBy(100).toNumber(),
  };
}
const RANGE_CONFIG: Record<
  IMobileSimpleChartRange,
  {
    interval: IHyperliquidCandleInterval;
    intervalSeconds: number;
    seconds?: number;
  }
> = {
  '1H': { interval: '1m', intervalSeconds: 60, seconds: 60 * 60 },
  '1D': { interval: '5m', intervalSeconds: 5 * 60, seconds: DAY_SECONDS },
  '1W': { interval: '1h', intervalSeconds: 60 * 60, seconds: 7 * DAY_SECONDS },
  '1M': {
    interval: '4h',
    intervalSeconds: 4 * 60 * 60,
    seconds: 30 * DAY_SECONDS,
  },
  '1Y': {
    interval: '1d',
    intervalSeconds: DAY_SECONDS,
    seconds: 365 * DAY_SECONDS,
  },
  All: { interval: '1d', intervalSeconds: DAY_SECONDS },
};

export function getSimpleChartRequest(
  range: IMobileSimpleChartRange,
  nowSeconds: number,
) {
  const { interval, intervalSeconds, seconds } = RANGE_CONFIG[range];
  return {
    interval,
    intervalSeconds,
    timeFrom: seconds === undefined ? 0 : Math.max(0, nowSeconds - seconds),
    timeTo: nowSeconds,
  };
}

export function getSimpleChartPoints({
  points,
  timeFrom,
  timeTo,
}: {
  points: IMarketTokenKLineDataPoint[];
  timeFrom: number;
  timeTo: number;
}): IMarketTokenChart {
  const prices = new Map<number, number>();
  for (const { t, c } of points) {
    if (
      Number.isFinite(t) &&
      Number.isFinite(c) &&
      c > 0 &&
      t >= timeFrom &&
      t <= timeTo
    ) {
      prices.set(t, c);
    }
  }
  return Array.from(prices.entries()).toSorted(([a], [b]) => a - b);
}
