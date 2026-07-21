import type { IHyperliquidCandleInterval } from './hyperliquidCandleUtils';
import type { ITradingViewIntervalOption } from '../../TradingViewChartControls/types';

export type ITradingViewNativeChartInterval =
  | '1'
  | '5'
  | '15'
  | '30'
  | '60'
  | '240'
  | '1D'
  | '1W';

export interface ITradingViewNativeKLineInterval extends ITradingViewIntervalOption {
  value: ITradingViewNativeChartInterval;
  seconds: number;
  marketWsValue: string;
  hyperliquidValue: IHyperliquidCandleInterval;
}

export const DEFAULT_TRADING_VIEW_NATIVE_KLINE_INTERVAL: ITradingViewNativeChartInterval =
  '60';

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
  ];

export function getTradingViewNativeKLineInterval(
  interval: string,
): ITradingViewNativeKLineInterval | undefined {
  return TRADING_VIEW_NATIVE_KLINE_INTERVALS.find(
    (option) => option.value === interval,
  );
}
