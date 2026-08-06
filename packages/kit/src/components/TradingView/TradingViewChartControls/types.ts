export interface ITradingViewIntervalOption {
  label: string;
  value: string;
  disabled?: boolean;
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

export type IChartSettingsSegmentValue = number | string;
export type ITradingViewNativeChartTypeControlMode = 'toggle' | 'select';
export type ITradingViewNativeIndicatorControlMode = 'dialog' | 'popover';
export type ITradingViewNativePriceMarketCapControlMode = 'settings' | 'select';
export type ITradingViewNativeControlsLayoutMode = 'mobile' | 'desktop';
