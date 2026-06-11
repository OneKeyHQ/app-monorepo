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

// Single source of truth for the legacy-chart kill switch. While `true`, the
// whole app falls back to the v6.3.0 chart: the remote-hosted TradingView
// WebView (no unified singleton, no desktop/native offline bundle, no prewarm/
// migration). Only the chart's RENDER/LOAD path is gated — the shared data-layer
// hooks (kline normalize, fallback, WS) are left untouched, since on the legacy
// path their new params are default no-ops and the unconditional ones are bug
// fixes we want to keep.
//
// Defaults to `true` (app-wide legacy). Wire this to a dev setting / remote gate
// later; keep it a function so callers re-read it instead of capturing a const.
export function isLegacyChartEnabled(): boolean {
  return true;
}

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
