/**
 * Offline TradingView chart on desktop.
 *
 * The chart bundle is shipped inside the asar (apps/desktop/app/tradingview-assets/)
 * and served to the chart <webview> under a custom, privileged scheme instead of
 * file://. A registered secure/standard scheme gives the chart a stable virtual
 * origin (`onekey-chart://local`), so its direct Hyperliquid `fetch()` / WebSocket
 * calls carry a real Origin and behave as a normal secure cross-origin page —
 * file:// would be a null/opaque origin and break CORS + secure-context APIs.
 *
 * This mirrors the native chart-webview modules, which serve the same bundle on a
 * virtual same-origin (Android: https://appassets.androidplatform.net, iOS:
 * onekey-chart:// custom scheme).
 *
 * Shared between the desktop main process (scheme registration + protocol handler)
 * and the renderer (URL building in useTradingViewUrl).
 */
export const DESKTOP_OFFLINE_CHART_SCHEME = 'onekey-chart';

export const DESKTOP_OFFLINE_CHART_HOST = 'local';

export const DESKTOP_OFFLINE_CHART_BASE_URL = `${DESKTOP_OFFLINE_CHART_SCHEME}://${DESKTOP_OFFLINE_CHART_HOST}/`;

// Entry document the renderer loads (params are appended as a query string, same
// as the online chart URL — the bundle reads them from location.search).
export const DESKTOP_OFFLINE_CHART_ENTRY_URL = `${DESKTOP_OFFLINE_CHART_BASE_URL}index.html`;
