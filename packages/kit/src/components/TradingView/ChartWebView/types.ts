import type { IStackStyle } from '@onekeyhq/components';

import type { IWebViewRef } from '../../WebView/types';
import type { ICustomReceiveHandlerData } from '../TradingViewV2/types';

export interface IChartWebViewBaseProps {
  // Full param set from useTradingViewUrl — used as query string (online) or
  // serialized to paramsJson (offline).
  params: Record<string, string>;
  // Remote URL (used in 'online' mode and as the web/legacy fallback source).
  onlineUrl: string;
  // Receives the chart's inbound messages, already shaped as the legacy
  // { data: ITradingViewMessage } envelope the existing handlers expect.
  customReceiveHandler?: (
    data: ICustomReceiveHandlerData,
  ) => void | Promise<void>;
  // Receives an IWebViewRef-compatible adapter (sendMessageViaInjectedScript /
  // reload) backed by the chart-webview module, so existing hooks work unchanged.
  onWebViewRef?: (ref: IWebViewRef | null) => void;
  // Fired when the underlying page finishes loading (forwarded from the module).
  // For the shared unified WebView this fires on the first cold load, or
  // immediately when the shared pool has already finished loading.
  onLoadEnd?: () => void;
  // Opt out of the host's automatic unified SYMBOL_CHANGE so the consumer can
  // drive its own (e.g. perps: source:'hyperliquid' + displayNames + ready
  // gating). The host still supplies the constant unified source + warm WebView.
  selfDrivenSymbol?: boolean;
  // This host is an offscreen prewarm, NOT a visible chart. It still warm-loads
  // the page + drives the symbol + prefetches data (as warmDriver), but must
  // NEVER claim native ownership (`active=false`) — otherwise it keeps the shared
  // WebView's renderer running offscreen on Android (which, unlike iOS WKWebView,
  // does not throttle offscreen pages), pinning CPU/GPU and growing RAM to OOM
  // while stalling the whole app. With active=false the native pauseIfIdle can
  // pause the renderer whenever no VISIBLE detail owns it.
  prewarm?: boolean;
}

export type IChartWebViewProps = IChartWebViewBaseProps & IStackStyle;
