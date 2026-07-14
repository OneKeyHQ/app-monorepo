/**
 * Offline TradingView chart on desktop.
 *
 * The chart bundle is shipped inside the desktop app asar under
 * apps/desktop/app/tradingview-assets/ and served to the chart <webview> via a
 * privileged custom scheme. This gives the chart a stable secure origin instead
 * of file://, which is required for CORS-sensitive fetch/WebSocket paths.
 */
export const DESKTOP_OFFLINE_CHART_SCHEME = 'onekey-chart';

export const DESKTOP_OFFLINE_CHART_HOST = 'local';

export const DESKTOP_OFFLINE_CHART_BASE_URL = `${DESKTOP_OFFLINE_CHART_SCHEME}://${DESKTOP_OFFLINE_CHART_HOST}/`;

export const DESKTOP_OFFLINE_CHART_ENTRY_URL = `${DESKTOP_OFFLINE_CHART_BASE_URL}index.html`;

export function isAllowedDesktopChartNavigation(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === `${DESKTOP_OFFLINE_CHART_SCHEME}:` &&
      parsed.host === DESKTOP_OFFLINE_CHART_HOST
    );
  } catch {
    return false;
  }
}
