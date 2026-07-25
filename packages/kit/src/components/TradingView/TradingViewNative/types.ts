import type { ReactNode } from 'react';

import type { ITradingViewNativeChartInterval } from './data/tradingViewNativeIntervals';

export type ITradingViewNativeHyperliquidEnvironment = 'mainnet' | 'testnet';
export type ITradingViewNativeChartType = 'candlestick' | 'line';

export type ITradingViewNativeSource =
  | {
      kind: 'hyperliquid';
      coin: string;
      environment: ITradingViewNativeHyperliquidEnvironment;
    }
  | {
      kind: 'market';
      fallbackCoinGeckoId?: string;
      networkId: string;
      tokenAddress: string;
      symbol: string;
      realtime: 'disabled' | 'websocket';
    };

export type ITradingViewNativeDataStatus =
  | 'idle'
  | 'loading'
  | 'live'
  | 'stale'
  | 'reconnecting'
  | 'error';

export interface ITradingViewNativeDataState {
  status: ITradingViewNativeDataStatus;
  error?: unknown;
  lastUpdatedAt?: number;
}

export interface ITradingViewNativePriceUpdateData {
  price: number;
  receivedAt: number;
  source: 'history' | 'realtime';
  timestamp: number;
}

export interface ITradingViewNativeIntervalChangeData {
  fromInterval: ITradingViewNativeChartInterval;
  toInterval: ITradingViewNativeChartInterval;
}

export interface ITradingViewNativeProps {
  testID?: string;
  source: ITradingViewNativeSource;
  enableNativeChartSettings?: boolean;
  nativeControlsLayoutMode?: 'mobile' | 'desktop';
  isNativeChartFullscreen?: boolean;
  nativeChartFullscreenHeader?: ReactNode;
  onDataStateChange?: (state: ITradingViewNativeDataState) => void;
  onIntervalChange?: (data: ITradingViewNativeIntervalChangeData) => void;
  onNativeSubIndicatorCountChange?: (count: number | null) => void;
  onNativeChartFullscreenChange?: (isFullscreen: boolean) => void;
  onPriceUpdate?: (data: ITradingViewNativePriceUpdateData) => void;
}
