import {
  TRADING_VIEW_NATIVE_CANDLE_STEP,
  TRADING_VIEW_NATIVE_MIN_ZOOM_SCALE,
} from '../chartConstants';

import type { IHyperliquidCandleInterval } from './providers/hyperliquid/hyperliquidCandleUtils';
import type { ITradingViewIntervalOption } from '../../TradingViewChartControls/types';

export type ITradingViewNativeChartInterval =
  | '1'
  | '5'
  | '15'
  | '30'
  | '60'
  | '240'
  | '1D'
  | '1W'
  | '1M';

export interface ITradingViewNativeKLineInterval extends ITradingViewIntervalOption {
  value: ITradingViewNativeChartInterval;
  seconds: number;
  marketWsValue: string;
  hyperliquidValue: IHyperliquidCandleInterval;
}

export const DEFAULT_TRADING_VIEW_NATIVE_KLINE_INTERVAL: ITradingViewNativeChartInterval =
  '60';

export const TRADING_VIEW_NATIVE_TIME_RANGE_MAX_CANDLE_COUNT = 198;

export const TRADING_VIEW_NATIVE_KLINE_INTERVALS: ITradingViewNativeKLineInterval[] =
  [
    {
      label: '1m',
      value: '1',
      seconds: 60,
      marketWsValue: '1m',
      hyperliquidValue: '1m',
    },
    {
      label: '5m',
      value: '5',
      seconds: 5 * 60,
      marketWsValue: '5m',
      hyperliquidValue: '5m',
    },
    {
      label: '15m',
      value: '15',
      seconds: 15 * 60,
      marketWsValue: '15m',
      hyperliquidValue: '15m',
    },
    {
      label: '30m',
      value: '30',
      seconds: 30 * 60,
      marketWsValue: '30m',
      hyperliquidValue: '30m',
    },
    {
      label: '1H',
      value: '60',
      seconds: 60 * 60,
      marketWsValue: '1h',
      hyperliquidValue: '1h',
    },
    {
      label: '4H',
      value: '240',
      seconds: 4 * 60 * 60,
      marketWsValue: '4h',
      hyperliquidValue: '4h',
    },
    {
      label: '1D',
      value: '1D',
      seconds: 24 * 60 * 60,
      marketWsValue: '1d',
      hyperliquidValue: '1d',
    },
    {
      label: '1W',
      value: '1W',
      seconds: 7 * 24 * 60 * 60,
      marketWsValue: '1w',
      hyperliquidValue: '1w',
    },
    {
      label: '1M',
      value: '1M',
      seconds: 30 * 24 * 60 * 60,
      marketWsValue: '1M',
      hyperliquidValue: '1M',
    },
  ];

export function getTradingViewNativeKLineInterval(
  interval: string,
): ITradingViewNativeKLineInterval | undefined {
  return TRADING_VIEW_NATIVE_KLINE_INTERVALS.find(
    (option) => option.value === interval,
  );
}

const TIME_RANGE_DURATION_SECONDS = {
  day: 24 * 60 * 60,
  month: 30 * 24 * 60 * 60,
  year: 365 * 24 * 60 * 60,
};

const DEFAULT_GO_TO_DATE_VISIBLE_RANGE_SECONDS =
  7 * TIME_RANGE_DURATION_SECONDS.day;

export function buildTradingViewNativeGoToDateTimeRange({
  timestamp,
  visibleRange,
}: {
  timestamp: number;
  visibleRange?: {
    from: number;
    to: number;
  };
}) {
  const visibleRangeSpan =
    visibleRange &&
    Number.isFinite(visibleRange.from) &&
    Number.isFinite(visibleRange.to)
      ? Math.max(
          visibleRange.to - visibleRange.from,
          DEFAULT_GO_TO_DATE_VISIBLE_RANGE_SECONDS,
        )
      : DEFAULT_GO_TO_DATE_VISIBLE_RANGE_SECONDS;
  const halfRangeSpan = Math.floor(visibleRangeSpan / 2);

  return {
    from: timestamp - halfRangeSpan,
    to: timestamp + halfRangeSpan,
  };
}

export function getTradingViewNativeKLineIntervalForTimeRange({
  chartWidth,
  currentInterval,
  from,
  to,
}: {
  chartWidth?: number;
  currentInterval: string;
  from: number;
  to: number;
}) {
  const currentIntervalConfig =
    getTradingViewNativeKLineInterval(currentInterval) ??
    TRADING_VIEW_NATIVE_KLINE_INTERVALS[4];
  const rangeSeconds = to - from;
  if (!Number.isFinite(rangeSeconds) || rangeSeconds <= 0) {
    return currentIntervalConfig;
  }

  let adaptiveInterval: ITradingViewNativeChartInterval;
  if (rangeSeconds <= TIME_RANGE_DURATION_SECONDS.day) {
    adaptiveInterval = '1';
  } else if (rangeSeconds <= 5 * TIME_RANGE_DURATION_SECONDS.day) {
    adaptiveInterval = '15';
  } else if (rangeSeconds <= TIME_RANGE_DURATION_SECONDS.month) {
    adaptiveInterval = '60';
  } else if (rangeSeconds <= 3 * TIME_RANGE_DURATION_SECONDS.month) {
    adaptiveInterval = '240';
  } else if (rangeSeconds <= TIME_RANGE_DURATION_SECONDS.year) {
    adaptiveInterval = '1D';
  } else if (rangeSeconds <= 3 * TIME_RANGE_DURATION_SECONDS.year) {
    adaptiveInterval = '1W';
  } else {
    adaptiveInterval = '1M';
  }
  const adaptiveIntervalConfig =
    getTradingViewNativeKLineInterval(adaptiveInterval) ??
    currentIntervalConfig;
  const minimumIntervalConfig =
    currentIntervalConfig.seconds < adaptiveIntervalConfig.seconds
      ? adaptiveIntervalConfig
      : currentIntervalConfig;
  if (
    chartWidth === undefined ||
    !Number.isFinite(chartWidth) ||
    chartWidth <= 0
  ) {
    return minimumIntervalConfig;
  }

  const visibleCandleCount = Math.max(
    Math.floor(
      chartWidth /
        (TRADING_VIEW_NATIVE_CANDLE_STEP * TRADING_VIEW_NATIVE_MIN_ZOOM_SCALE),
    ) - 2,
    1,
  );
  const candleBudget = Math.min(
    visibleCandleCount,
    TRADING_VIEW_NATIVE_TIME_RANGE_MAX_CANDLE_COUNT,
  );
  const minimumIntervalIndex = TRADING_VIEW_NATIVE_KLINE_INTERVALS.findIndex(
    (interval) => interval.value === minimumIntervalConfig.value,
  );
  return (
    TRADING_VIEW_NATIVE_KLINE_INTERVALS.slice(
      Math.max(minimumIntervalIndex, 0),
    ).find(
      (interval) =>
        Math.ceil(rangeSeconds / interval.seconds) + 1 <= candleBudget,
    ) ??
    TRADING_VIEW_NATIVE_KLINE_INTERVALS[
      TRADING_VIEW_NATIVE_KLINE_INTERVALS.length - 1
    ]
  );
}
