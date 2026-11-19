import type { ITradingViewNativeCandleTimeMode } from '../types';

export function getTradingViewNativeCandleTimestampAtOffset({
  timestamp,
  candleIntervalSeconds,
  candleTimeMode = 'calendar',
  offset,
}: {
  timestamp: number;
  candleIntervalSeconds: number;
  candleTimeMode?: ITradingViewNativeCandleTimeMode;
  offset: number;
}) {
  'worklet';

  if (
    candleTimeMode === 'calendar' &&
    candleIntervalSeconds === 30 * 24 * 60 * 60
  ) {
    const date = new Date(timestamp * 1000);
    const day = date.getUTCDate();
    const lastDay = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
    ).getUTCDate();
    // UTC+8 month boundaries fall on the preceding month's last UTC day.
    const isPreviousMonthEnd = day === lastDay && date.getUTCHours() > 0;
    if (day === 1 || isPreviousMonthEnd) {
      date.setUTCMonth(
        date.getUTCMonth() + offset + (isPreviousMonthEnd ? 1 : 0),
        isPreviousMonthEnd ? 0 : 1,
      );
      return date.getTime() / 1000;
    }
  }
  // CoinGecko monthly candles use fixed 30-day Unix buckets.
  return timestamp + offset * candleIntervalSeconds;
}

/**
 * The candle that `time` falls in, e.g. a time taken from a chart with another
 * interval. Slots continue past both ends of the data, so `index` can lie
 * outside `points`.
 */
export function getTradingViewNativeCandleSlotAtTime({
  candleIntervalSeconds,
  candleTimeMode,
  points,
  time,
}: {
  candleIntervalSeconds: number;
  candleTimeMode?: ITradingViewNativeCandleTimeMode;
  points: readonly { t: number }[];
  time: number;
}): { index: number; timestamp: number } | null {
  'worklet';

  const lastIndex = points.length - 1;
  if (lastIndex < 0 || !Number.isFinite(time) || !(candleIntervalSeconds > 0)) {
    return null;
  }
  if (time < points[0].t || time >= points[lastIndex].t) {
    const anchorIndex = time < points[0].t ? 0 : lastIndex;
    const anchor = {
      timestamp: points[anchorIndex].t,
      candleIntervalSeconds,
      candleTimeMode,
    };
    let offset = Math.floor((time - anchor.timestamp) / candleIntervalSeconds);
    let timestamp = getTradingViewNativeCandleTimestampAtOffset({
      ...anchor,
      offset,
    });
    // Calendar months differ in length, so step to the slot holding the time.
    while (timestamp > time) {
      offset -= 1;
      timestamp = getTradingViewNativeCandleTimestampAtOffset({
        ...anchor,
        offset,
      });
    }
    let next = getTradingViewNativeCandleTimestampAtOffset({
      ...anchor,
      offset: offset + 1,
    });
    while (next <= time) {
      offset += 1;
      timestamp = next;
      next = getTradingViewNativeCandleTimestampAtOffset({
        ...anchor,
        offset: offset + 1,
      });
    }
    return { index: anchorIndex + offset, timestamp };
  }
  // A time inside a gap in the data belongs to the candle before the gap.
  let low = 0;
  let high = lastIndex;
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (points[middle].t <= time) low = middle;
    else high = middle;
  }
  return { index: low, timestamp: points[low].t };
}
