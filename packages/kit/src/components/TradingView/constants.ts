export const TRADING_VIEW_DISABLED_FEATURES = {
  TIMEFRAME_SELECTOR: 'timeframeSelector',
  TIME_SCALE: 'timeScale',
  PRICE_SCALE: 'priceScale',
  PRICE_MARKET_CAP_TOGGLE: 'priceMarketCapToggle',
  INDICATORS: 'indicators',
  SETTINGS: 'settings',
  CHART_TYPE: 'chartType',
  RESET_LAYOUT: 'resetLayout',
  FULLSCREEN: 'fullscreen',
  LAYOUT_TOGGLE: 'layoutToggle',
  DRAWING_TOOLBAR: 'drawingToolbar',
} as const;

export const TRADING_VIEW_DISABLED_FEATURES_URL_PARAM = 'disabledFeatures';

export type ITradingViewDisabledFeature =
  (typeof TRADING_VIEW_DISABLED_FEATURES)[keyof typeof TRADING_VIEW_DISABLED_FEATURES];
