export type IChartWebViewMode = 'legacy' | 'offline' | 'online';

/**
 * Code-level switch for how the chart is rendered (no runtime toggle / UI).
 *
 * - 'legacy'  : keep the existing kit WebView (current behavior, unchanged).
 * - 'offline' : load the app-bundled chart via the chart-webview native module
 *               (assets/tradingview-assets, fetched by
 *               development/scripts/fetch-tradingview-assets.mjs).
 * - 'online'  : load the remote TradingView URL via the chart-webview module.
 *
 * Native only — on web TradingView always uses 'legacy' (the module is native).
 * Flip this to 'offline' (or 'online') to exercise the new path.
 */
export const CHART_WEBVIEW_MODE: IChartWebViewMode = 'offline';

// Must match the folder name bundled into the native apps (iOS Run Script /
// Android copyChartWebviewAssets) and the module's localBundle resolution.
export const CHART_WEBVIEW_LOCAL_BUNDLE = 'tradingview-assets';
export const CHART_WEBVIEW_ENTRY = 'index.html';
