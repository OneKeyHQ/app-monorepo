export type ITradingViewNativeHyperliquidEnvironment = 'mainnet' | 'testnet';

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

export interface ITradingViewNativeProps {
  testID?: string;
  source: ITradingViewNativeSource;
  nativeControlsLayoutMode?: 'mobile' | 'desktop';
  onDataStateChange?: (state: ITradingViewNativeDataState) => void;
  onNativeSubIndicatorCountChange?: (count: number | null) => void;
}
