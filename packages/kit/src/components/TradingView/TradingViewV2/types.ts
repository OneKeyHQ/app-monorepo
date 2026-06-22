export interface ITradingViewHistoryData {
  method: string;
  resolution: string;
  from: number;
  to: number;
  firstDataRequest: boolean;
}

export interface ITradingViewLayoutData {
  layout: string; // JSON string format of layout data
}

export interface ITradingViewTouchScrollData {
  deltaY?: number;
}

export interface ITradingViewIndicatorsDialogData {
  action?: 'open' | 'close';
  isOpen?: boolean;
  timestamp?: number;
}

export interface ITradingViewInteractionOverlayData {
  action?: 'open' | 'close';
  isOpen?: boolean;
  timestamp?: number;
}

export interface ITradingViewPriceUpdateData {
  symbol?: string;
  tokenAddress?: string;
  networkId?: string;
  price?: string | number;
  timestamp?: number;
  interval?: string;
  source?: 'history' | 'realtime';
}

export interface ITradingViewIntervalOption {
  label: string;
  value: string;
}

export interface ITradingViewIntervalConfigData {
  intervals: ITradingViewIntervalOption[];
  activeInterval: string;
  timestamp?: number;
}

export interface ITradingViewIndicatorOption {
  label: string;
  value: string;
  active?: boolean;
}

export interface ITradingViewChartTypeOption {
  label: string;
  value: number;
}

export type ITradingViewPriceMarketCapMode = 'price' | 'marketcap';

export interface ITradingViewPriceMarketCapOption {
  label: string;
  value: ITradingViewPriceMarketCapMode;
}

export type ITradingViewPriceScaleMode = 'auto' | 'log' | 'percentage';

export interface ITradingViewPriceScaleOption {
  label: string;
  value: ITradingViewPriceScaleMode;
}

export interface ITradingViewNativeChartControlsConfigData {
  intervals?: ITradingViewIntervalOption[];
  activeInterval?: string;
  indicatorsEnabled?: boolean;
  indicators: ITradingViewIndicatorOption[];
  chartTypesEnabled?: boolean;
  chartTypes: ITradingViewChartTypeOption[];
  activeChartType: number;
  resetLayout?: {
    enabled: boolean;
    label: string;
  };
  priceMarketCap?: {
    enabled: boolean;
    label: string;
    options: ITradingViewPriceMarketCapOption[];
    activeMode: ITradingViewPriceMarketCapMode;
  };
  priceScale?: {
    enabled: boolean;
    label: string;
    options: ITradingViewPriceScaleOption[];
    activeMode: ITradingViewPriceScaleMode;
  };
  timestamp?: number;
}

// Union type to support different data structures
type ITradingViewData =
  | ITradingViewHistoryData
  | ITradingViewLayoutData
  | ITradingViewTouchScrollData
  | ITradingViewIndicatorsDialogData
  | ITradingViewInteractionOverlayData
  | ITradingViewPriceUpdateData
  | ITradingViewIntervalConfigData
  | ITradingViewNativeChartControlsConfigData;

interface ITradingViewMessage {
  scope?: string;
  method: string;
  origin: string;
  data: ITradingViewData;
}

export interface ICustomReceiveHandlerData {
  scope?: string;
  data: ITradingViewMessage;
}

// Type guard functions
export function isHistoryData(
  data: ITradingViewData,
): data is ITradingViewHistoryData {
  return (
    'method' in data && 'resolution' in data && 'from' in data && 'to' in data
  );
}

export function isLayoutData(
  data: ITradingViewData,
): data is ITradingViewLayoutData {
  return 'layout' in data;
}
