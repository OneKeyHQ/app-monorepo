import type { IChartWebViewProps } from './types';

/**
 * Web / non-native fallback.
 *
 * The chart-webview offline module is native-only, so on web TradingView keeps
 * using the legacy WebView. TradingViewV2 gates ChartWebView behind
 * platformEnv.isNative, so this is never actually rendered on web — it exists
 * only to keep the import resolvable without pulling the native module into the
 * web bundle.
 */
export function ChartWebView(_props: IChartWebViewProps) {
  return null;
}

export default ChartWebView;
