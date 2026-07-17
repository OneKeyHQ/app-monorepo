export interface ITradingViewNativeProps {
  testID?: string;
  networkId?: string;
  tokenAddress?: string;
  symbol?: string;
  decimal?: number;
  nativeControlsLayoutMode?: 'mobile' | 'desktop';
  onNativeSubIndicatorCountChange?: (count: number | null) => void;
}
