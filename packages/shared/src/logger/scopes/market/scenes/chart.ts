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
}
