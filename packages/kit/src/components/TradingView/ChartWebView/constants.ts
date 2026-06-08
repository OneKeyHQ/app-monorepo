import platformEnv from '@onekeyhq/shared/src/platformEnv';

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
 *
 * Gated purely on whether this is a PRODUCTION build (build-time constant from
 * buildTimeEnv.js, no runtime env vars): production ships the offline bundle, so
 * it loads offline; dev/internal builds don't stage the assets (loading offline
 * would white-screen), so they use the chart-webview module against the online
 * URL — still exercising the new path without the bundle.
 */
export const CHART_WEBVIEW_MODE: IChartWebViewMode = platformEnv.isProduction
  ? 'offline'
  : 'online';

/**
 * Desktop offline chart switch (code-level, no runtime toggle).
 *
 * When true AND the offline bundle was shipped into the asar (signalled at
 * runtime via the `tradingViewOfflineReady` desktop global), desktop loads the
 * chart from the local onekey-chart:// virtual origin instead of the remote URL.
 * Otherwise (flag off, or no bundle on open-source / no-token builds) desktop
 * keeps using the online chart. Native is governed separately by
 * CHART_WEBVIEW_MODE; this flag is desktop-only and the renderer reads it
 * through useTradingViewUrl.
 */
export const CHART_WEBVIEW_DESKTOP_OFFLINE_ENABLED = true;

// Must match the folder name bundled into the native apps (iOS Run Script /
// Android copyChartWebviewAssets) and the module's localBundle resolution.
export const CHART_WEBVIEW_LOCAL_BUNDLE = 'tradingview-assets';
export const CHART_WEBVIEW_ENTRY = 'index.html';

/**
 * Reuse ONE warm WebView across every chart — market AND perps — through the
 * native module's singleton pool, instead of cold-booting a private WebView on
 * every chart mount. The focused screen owns the shared WebView (arbitrated by
 * the `active` prop); inactive screens freeze to a snapshot but keep it alive.
 *
 * Native + offline only. See ChartSingletonTestPage in app-modules: true
 * no-reload switching additionally requires a constant unified source
 * (scene=unified) + switching symbols via the SYMBOL_CHANGE bridge message
 * rather than changing paramsJson.
 */
export const CHART_WEBVIEW_POOLED = true;

// Single shared pool key for the whole app: market and perps reuse one WebView.
export const CHART_WEBVIEW_REUSE_KEY = 'onekey-chart-singleton';

/**
 * How the shared WebView is driven (native + offline only):
 *
 * - 'classic'  : each token serializes its symbol/address/decimal into paramsJson,
 *                so switching tokens changes the source URL and RELOADS the page.
 * - 'unified'  : the page boots ONCE with a constant `scene=unified` source; every
 *                token/coin switch is delivered via a SYMBOL_CHANGE bridge message,
 *                so the shared WebView never reloads (true millisecond switch across
 *                market AND perps). Requires the unified chart bundle
 *                (>= 0.1.14-test.1, per-symbol market decimal).
 */
export const CHART_WEBVIEW_SCENE: 'classic' | 'unified' = 'unified';

// Boot symbol for the constant unified source. Token-independent so every host
// passes an IDENTICAL source (else the shared WebView reloads); the real symbol
// arrives immediately via SYMBOL_CHANGE. Replaced before the user sees it.
export const CHART_WEBVIEW_UNIFIED_INITIAL_SYMBOL = 'HL:BTC';

// The ONLY param keys kept in the constant unified source — app-global values
// (identical for market and perps). Everything business/token-specific (symbol,
// type, storageNamespace, decimal, enablePerpsTradingUi, ...) is dropped here and
// delivered via SYMBOL_CHANGE, so market and perps hosts produce a byte-identical
// source and the shared WebView never reloads when switching between them.
export const CHART_WEBVIEW_UNIFIED_APP_GLOBAL_KEYS = [
  'timezone',
  'locale',
  'platform',
  'theme',
  'appVersion',
] as const;
