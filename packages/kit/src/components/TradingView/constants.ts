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

// Market chart localStorage buckets (chart-side `storageNamespace`). Callers
// pass these explicitly — TradingViewV2 no longer falls back to a default.
export const MARKET_TRADING_VIEW_STORAGE_NAMESPACE = 'market';
export const MARKET_HYPERLIQUID_TRADING_VIEW_STORAGE_NAMESPACE =
  'market-hyperliquid';

// `scene` URL/param signal telling the chart a MARKET token's K-line源 is
// Hyperliquid (set by useHyperLiquidKlineSource). The unified host reads it to
// route to the Hyperliquid datafeed; without it, HL-backed market tokens (e.g.
// BTC) wrongly route to the OneKey market datafeed and render empty candles.
export const TRADING_VIEW_MARKET_HYPERLIQUID_SCENE = 'market-hyperliquid';

// Display prefix on Hyperliquid market symbols (e.g. 'HL:BTC'). Datafeeds key
// off the bare coin id; the prefix is UI-only.
export const HL_DISPLAY_SYMBOL_PREFIX = 'HL:';

export type ITradingViewDisabledFeature =
  (typeof TRADING_VIEW_DISABLED_FEATURES)[keyof typeof TRADING_VIEW_DISABLED_FEATURES];
