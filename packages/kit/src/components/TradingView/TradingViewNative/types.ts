import type { ITradingViewNativeChartInterval } from './data/tradingViewNativeIntervals';

export type ITradingViewNativeHyperliquidEnvironment = 'mainnet' | 'testnet';

export type ITradingViewNativeCoinGeckoHistorySource = {
  provider: 'coinGecko';
  coinGeckoId: string;
};

export type ITradingViewNativeMarketHistorySource =
  | ITradingViewNativeCoinGeckoHistorySource
  | {
      provider: 'market';
      fallback?: ITradingViewNativeCoinGeckoHistorySource;
    };

export type ITradingViewNativeSource =
  | {
      kind: 'hyperliquid';
      coin: string;
      environment: ITradingViewNativeHyperliquidEnvironment;
    }
  | {
      kind: 'market';
      networkId: string;
      tokenAddress: string;
      symbol: string;
      realtime: 'disabled' | 'websocket';
      history?: ITradingViewNativeMarketHistorySource;
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
  nativeControlsLayoutMode?: 'mobile' | 'desktop';
  onDataStateChange?: (state: ITradingViewNativeDataState) => void;
  onIntervalChange?: (data: ITradingViewNativeIntervalChangeData) => void;
  onNativeSubIndicatorCountChange?: (count: number | null) => void;
  onPriceUpdate?: (data: ITradingViewNativePriceUpdateData) => void;
}
