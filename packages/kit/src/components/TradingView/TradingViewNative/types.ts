import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

export interface ITradingViewNativeProps {
  testID?: string;
  networkId?: string;
  tokenAddress?: string;
  symbol?: string;
  decimal?: number;
  nativeControlsLayoutMode?: 'mobile' | 'desktop';
  onNativeSubIndicatorCountChange?: (count: number | null) => void;
}

export interface ITradingViewNativeChartProps {
  isSwitchingInterval: boolean;
  points: IMarketTokenKLineDataPoint[];
  testID?: string;
}

export interface ITradingViewNativeChartColors {
  background: string;
  grid: string;
  up: string;
  down: string;
}
