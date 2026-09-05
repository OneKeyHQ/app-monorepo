export interface ITradingViewHistoryData {
  method: string;
  requestId?: string;
  resolution: string;
  from: number;
  to: number;
  countBack?: number;
  firstDataRequest: boolean;
}

export interface ITradingViewHistoryReadyData {
  requestId: string;
  resolution: string;
  firstDataRequest: boolean;
  status: 'success' | 'empty' | 'failed';
  symbol?: string;
  tokenAddress?: string;
  networkId?: string;
}

export interface ITradingViewLegacyHistoryReadyData {
  status: 'success' | 'empty' | 'failed';
  period: string;
  symbol: string;
  tokenAddress: string;
  networkId: string;
  webViewLoadGeneration: number;
}

export interface ITradingViewFirstPaintReadyData {
  requestId: string;
  resolution: string;
  firstDataRequest: boolean;
  status: 'rendered' | 'empty' | 'failed';
  returnedCount: number;
  source: 'bootstrap' | 'bridge';
  bootstrapId?: string;
  symbol?: string;
  tokenAddress?: string;
  networkId?: string;
}

export interface ITradingViewChartReadyData {
  symbol?: string;
  containerId?: string;
  capabilities?: {
    marketSymbolSync?: boolean;
    marketSymbolSyncStudies?: boolean;
    marketAppKlineTransport?: boolean;
    intervalAck?: boolean;
    historyReadyAck?: boolean;
    firstPaintReady?: boolean;
  };
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
  disabled?: boolean;
}

export interface ITradingViewIntervalConfigData {
  intervals: ITradingViewIntervalOption[];
  activeInterval: string;
  persist?: boolean;
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
  layoutRestored?: boolean;
  timestamp?: number;
}

export type ITradingViewKLineLoadStatus = 'empty' | 'failed';

export interface ITradingViewKLineRequestRange {
  from: number;
  to: number;
  countBack?: number;
  firstDataRequest: boolean;
}

export interface ITradingViewKLineDataReadyData {
  period: string;
  requestRange?: ITradingViewKLineRequestRange;
  storageNamespace?: string;
}

export interface ITradingViewKLinePeriodChangeData {
  fromPeriod: string;
  toPeriod: string;
  storageNamespace?: string;
}

export interface ITradingViewKLineLoadErrorData {
  status: ITradingViewKLineLoadStatus;
  period: string;
  message?: string;
  requestRange?: ITradingViewKLineRequestRange;
  storageNamespace?: string;
}

// Union type to support different data structures
type ITradingViewData =
  | ITradingViewHistoryData
  | ITradingViewChartReadyData
  | ITradingViewFirstPaintReadyData
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
