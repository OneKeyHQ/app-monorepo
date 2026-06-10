import { BaseScene } from '../../../base/baseScene';
import { LogToLocal } from '../../../base/decorators';

// Diagnostic only (no analytics): confirm, in any build including production,
// whether the TradingView chart resolves to the offline app-bundled assets
// (assets/tradingview-assets) or the remote online URL, and on which platform /
// path. @LogToLocal writes to the persistent device/desktop log so the offline
// vs online decision can be verified on a real release build.
export class ChartScene extends BaseScene {
  @LogToLocal({ level: 'info' })
  public chartSource(params: {
    // 'ios' | 'android' | 'desktop' | 'web' ...
    platform: string;
    // 'market' | 'perps' (which consumer mounted the chart)
    type?: string;
    // Render mode, same vocab on native + desktop: 'offline' app-bundled assets,
    // 'online' remote URL, or 'legacy' kit WebView.
    mode: 'offline' | 'online' | 'legacy';
    // The resolved load source actually used.
    sourceKind: 'offline' | 'online';
    // Native unified vs classic; omitted on desktop.
    scene?: string;
    // Native warm singleton pool in use.
    pooled?: boolean;
    // An online URL is available as the fallback source.
    hasOnlineFallback?: boolean;
  }) {
    return params;
  }

  @LogToLocal({ level: 'info' })
  public chartLoadEnd(params: {
    platform: string;
    type?: string;
    sourceKind: 'offline' | 'online';
  }) {
    return params;
  }

  // DEBUG instrumentation: native WKWebView load failure (didFail /
  // didFailProvisional). Previously the page-load error was forwarded to JS but
  // never logged, so a failed offline load was completely silent — the only
  // signal was a MISSING chartLoadEnd. Make failures explicit.
  @LogToLocal({ level: 'error' })
  public chartError(params: {
    platform: string;
    type?: string;
    sourceKind?: 'offline' | 'online';
    message: string;
  }) {
    return params;
  }

  // DEBUG instrumentation: the prewarm host (ChartPrewarm) lifecycle, so we can
  // confirm WHEN/IF the perps-home prewarm actually mounts and drives a symbol
  // relative to the detail page opening (Q1: why prewarm doesn't warm).
  @LogToLocal({ level: 'info' })
  public chartPrewarm(params: {
    platform: string;
    // 'mount' | 'unmount' | 'disabled'
    phase: string;
    type?: string;
    symbol?: string;
    // Whether a real symbol was supplied (vs the neutral reset placeholder).
    hasSymbol?: boolean;
    enabled?: boolean;
    // Which data handler the prewarm host wired up ('perps' | 'market' | 'none').
    // 'none' means the page's $private data requests would be dropped (the old
    // behavior that left the prewarm a data-less shell).
    handler?: string;
  }) {
    return params;
  }

  // DEBUG instrumentation: ChartWebView host focus/ownership state on the JS
  // side, mirroring the native reconcile. `active` is what gets sent to native
  // and gates pool ownership (Q1).
  // DEBUG instrumentation (Q2: market chart shows no data): the kline/bars
  // request/response cycle between the chart page and the OneKey market backend.
  // phase 'request' = page asked for bars; 'response' = bars (or empty) sent
  // back (points/total); 'error' = the fetch threw (likely cause of a blank
  // chart).
  @LogToLocal({ level: 'info' })
  public chartKline(params: {
    platform: string;
    // 'request' | 'response' | 'error'
    phase: string;
    type?: string;
    symbol?: string;
    networkId?: string;
    resolution?: string;
    from?: number;
    to?: number;
    points?: number;
    total?: number;
    forcedEmpty?: boolean;
    willSend?: boolean;
    message?: string;
    // DEBUG: raw shape of the first bar (to confirm OHLCV presence / types).
    rawSample?: string;
    sample?: string;
    sampleKeys?: string;
    closeType?: string;
    // DEBUG: how many bars needed OHLC synthesized from close (Q2 fix worked
    // around a close-only API response).
    synthesizedOHLC?: number;
  }) {
    return params;
  }

  @LogToLocal({ level: 'info' })
  public chartHost(params: {
    platform: string;
    type?: string;
    // 'mount' | 'unmount' | 'focus' | 'hybridReady' | 'eagerSend' | 'resync'
    event: string;
    isFocused?: boolean;
    autoDriveSymbol?: boolean;
    hybridReady?: boolean;
    symbol?: string;
    pooled?: boolean;
    // For event='barsState': whether the chart library reported bars present.
    hasData?: boolean;
    // For event='msgIn': the $private method the page sent to this handler —
    // confirms whether market getKLineData actually reaches the market handler
    // (vs being routed to the perps handler on the shared pool).
    method?: string;
  }) {
    return params;
  }
}
