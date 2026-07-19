export type ITradingViewNativeDataSource =
  | 'hyperliquid'
  | 'market-websocket'
  | 'market-polling';

export interface ITradingViewNativeProps {
  testID?: string;
  networkId?: string;
  tokenAddress?: string;
  symbol?: string;
  hyperliquidCoin?: string;
  decimal?: number;
  dataSource?: ITradingViewNativeDataSource;
  nativeControlsLayoutMode?: 'mobile' | 'desktop';
  onNativeSubIndicatorCountChange?: (count: number | null) => void;
}
