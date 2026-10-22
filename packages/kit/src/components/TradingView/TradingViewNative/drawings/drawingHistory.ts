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
): IDrawingHistoryLoader {
  return async (from, to, signal) => {
    if (
      !Number.isFinite(from) ||
      !Number.isFinite(to) ||
      from > to ||
      signal.aborted
    )
      return null;
    const interval =
      intervals.find((option) => (to - from) / option.seconds < 5000) ??
      intervals[intervals.length - 1];
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
