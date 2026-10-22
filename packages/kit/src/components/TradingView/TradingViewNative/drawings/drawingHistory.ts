import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

import { TRADING_VIEW_NATIVE_KLINE_INTERVALS } from '../data/tradingViewNativeIntervals';

import type { ITradingViewNativeHistoryDataProvider } from '../data/providers/types';
import type { ITradingViewNativeKLineInterval } from '../data/tradingViewNativeIntervals';

export type IDrawingHistoryData = {
  points: IMarketTokenKLineDataPoint[];
  interval: number;
};
export type IDrawingHistoryLoader = (
  from: number,
  to: number,
  signal: AbortSignal,
) => Promise<IDrawingHistoryData | null>;

export function createDrawingHistoryLoader(
  provider: ITradingViewNativeHistoryDataProvider,
  intervals: ITradingViewNativeKLineInterval[] = TRADING_VIEW_NATIVE_KLINE_INTERVALS,
  maxIntervalSeconds = Number.POSITIVE_INFINITY,
): IDrawingHistoryLoader {
  return async (from, to, signal) => {
    if (
      !Number.isFinite(from) ||
      !Number.isFinite(to) ||
      from > to ||
      signal.aborted
    )
      return null;
    // Keep the chart-candle fallback when the full range cannot fit without coarsening.
    const interval = intervals.find(
      (option) =>
        option.seconds <= maxIntervalSeconds &&
        Math.floor(to / option.seconds) -
          Math.floor(from / option.seconds) +
          1 <=
          5000,
    );
    if (!interval) return null;
    const points = new Map<number, IMarketTokenKLineDataPoint>();
    const timeFrom = Math.floor(from / interval.seconds) * interval.seconds;
    let timeTo = to;
    for (
      let page = 0;
      page < 30 && timeTo >= timeFrom && !signal.aborted;
      page += 1
    ) {
      const response = await provider.fetchHistory({
        interval,
        timeFrom,
        timeTo,
        signal,
      });
      if (signal.aborted) return null;
      if (!response?.points.length || response.pointType === 'single') break;
      let earliest = timeTo;
      for (const point of response.points) {
        if (Number.isFinite(point.t)) earliest = Math.min(earliest, point.t);
        if (point.t >= timeFrom && point.t <= to && points.size < 5000)
          points.set(point.t, point);
      }
      if (earliest <= timeFrom || earliest >= timeTo || points.size >= 5000)
        break;
      timeTo = earliest - 1;
    }
    if (!points.size) return null;
    return {
      points: [...points.values()].toSorted((a, b) => a.t - b.t),
      interval: interval.seconds,
    };
  };
}
