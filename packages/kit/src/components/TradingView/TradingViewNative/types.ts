import type { ReactNode } from 'react';

import type { ITradingViewNativeChartInterval } from './data/tradingViewNativeIntervals';

export type ITradingViewNativeHyperliquidEnvironment = 'mainnet' | 'testnet';
export type ITradingViewNativeChartType = 'candlestick' | 'line';
export type ITradingViewNativePriceScaleMode = 'linear' | 'logarithmic';

export interface ITradingViewNativeCandleLabels {
  close: string;
  high: string;
  low: string;
  open: string;
}

export type ITradingViewNativeSource =
  | {
      kind: 'hyperliquid';
      coin: string;
      environment: ITradingViewNativeHyperliquidEnvironment;
    }
  | {
      kind: 'market';
      fallbackCoinGeckoId?: string;
      isNative?: boolean;
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

export type ITradingViewNativeInitialRightOffset =
  | {
      type: 'chartWidthPercentage';
      value: number;
    }
  | {
      type: 'pointCount';
      value: number;
    };

export interface ITradingViewNativeProps {
  testID?: string;
  source: ITradingViewNativeSource;
  enableNativeChartSettings?: boolean;
  initialRightOffset?: ITradingViewNativeInitialRightOffset;
  /** Limits new selections without hiding sub-indicators that are already active. */
  maxSelectableSubIndicatorCount?: number;
  nativeControlsLayoutMode?: 'mobile' | 'desktop';
  isNativeChartFullscreen?: boolean;
  nativeChartFullscreenHeader?: ReactNode;
  isChartSwitchDisabled?: boolean;
  onChartSwitch?: () => void;
  onDataStateChange?: (state: ITradingViewNativeDataState) => void;
  onIntervalChange?: (data: ITradingViewNativeIntervalChangeData) => void;
  onNativeSubIndicatorCountChange?: (count: number | null) => void;
  onNativeChartFullscreenChange?: (isFullscreen: boolean) => void;
  onPriceUpdate?: (data: ITradingViewNativePriceUpdateData) => void;
}
