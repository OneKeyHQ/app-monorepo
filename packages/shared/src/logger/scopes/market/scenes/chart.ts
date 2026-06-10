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
    // Android-only: the offline bundle mounts the legacy chart origin (Part G)
    // so the old localStorage keys are read with zero migration. iOS/desktop
    // leave this undefined.
    assetHost?: string;
  }) {
    return params;
  }

  // Diagnostic: the one-shot chart-mode decision computed at cold start (Part
  // B2). Logged ONCE from the snapshot init (never from getChartWebViewMode,
  // which runs in render). Captures every input that feeds the offline / online
  // / legacy resolution so a release build's decision can be reconstructed.
  @LogToLocal({ level: 'info' })
  public chartModeDecision(params: {
    platform: string;
    isProduction: boolean;
    // Whether the server decided online for the persisted decision.
    serverOnline: boolean;
    // The app version the persisted decision was made for.
    decidedForVersion: string;
    // The current app version (platformEnv.version).
    currentVersion: string;
    // decidedForVersion === currentVersion (the stale-decision reset net).
    versionMatch: boolean;
    // QA dev override (Part L1), when set.
    devOverride?: 'offline' | 'legacy';
    // The effective mode, identical to getChartWebViewMode().
    resolvedMode: 'offline' | 'online' | 'legacy';
  }) {
    return params;
  }

  // Diagnostic: the server-driven chart-source fetch (online vs offline). The
  // fetch is silent by contract (no toast / no throw), so this LogToLocal is the
  // only signal of whether the decision was refreshed or fell back.
  @LogToLocal({ level: 'info' })
  public chartSourceFetch(params: {
    ok: boolean;
    // The server's online decision (only on a successful, valid response).
    online?: boolean;
    // On failure: whether the previous persisted decision was kept, or the
    // offline default is left in place because none existed.
    fallback?: 'kept-previous' | 'default-offline';
    error?: string;
  }) {
    return params;
  }

  // Diagnostic: the TradingView chart-data migration state machine (Part D).
  // Tracks the export -> restore lifecycle across cold starts so a stuck or
  // skipped migration can be diagnosed from the device/desktop log.
  @LogToLocal({ level: 'info' })
  public chartMigration(params: {
    platform: string;
    event:
      | 'init-skip-first-install'
      | 'init-deferred'
      | 'export-start'
      | 'export-ok'
      | 'export-empty'
      | 'export-fail'
      | 'restore-sent'
      | 'restore-ack'
      | 'restore-timeout'
      | 'done'
      | 'reset';
    launchTimes?: number;
    keyCount?: number;
    attempt?: number;
    requestId?: string;
    ok?: boolean;
    restoredCount?: number;
    skippedCount?: number;
    reason?: string;
    state?: string;
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

  // Diagnostic: which chart host branch a scene actually rendered. The
  // chart-mode gate is decided per-runtime (the unified native ChartWebView vs
  // the legacy kit WebView), and a cross-runtime gate bug silently forced the
  // legacy branch on mobile. Emit this ONCE per mount / when the branch decision
  // changes (never every render) so the live branch can be confirmed on a real
  // build. Captures every input that fed the fork.
  @LogToLocal({ level: 'info' })
  public chartHostRender(params: {
    // Which consumer mounted the chart.
    scene: 'perps' | 'market';
    symbol: string;
    // The render branch actually taken.
    component: 'unified-native' | 'legacy-webview';
    // Inputs that fed the fork (mirrors the host's `useUnifiedHost` expression).
    useUnifiedHost: boolean;
    bootSnapshotReady: boolean;
    mode: 'offline' | 'online' | 'legacy';
    platform: string;
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
}
