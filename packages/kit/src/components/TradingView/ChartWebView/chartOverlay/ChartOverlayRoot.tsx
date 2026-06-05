/**
 * Web / native / ext fallback.
 *
 * The desktop warm chart overlay is desktop-only (it keeps one persistent
 * Electron <webview> alive at the app root). Native gets the same warmth from
 * the chart-webview module's singleton pool; web has no offline chart. So this
 * renders nothing everywhere except desktop (ChartOverlayRoot.desktop.tsx).
 */
export function ChartOverlayRoot() {
  return null;
}

export default ChartOverlayRoot;
