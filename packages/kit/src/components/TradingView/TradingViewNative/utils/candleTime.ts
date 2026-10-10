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
