import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import WebView from '../../../WebView';
import { useTradingViewUrl } from '../../hooks';

import { chartOverlayController } from './controller';
import { getDesktopOfflineChartReady } from './ready';
import { buildUnifiedChartUrl } from './unifiedUrl';

import type { IWebViewRef } from '../../../WebView/types';
import type { ICustomReceiveHandlerData } from '../../TradingViewV2/types';

// Below app dialogs/sheets (high z-index) but above page content.
const OVERLAY_Z_INDEX = 10;

/**
 * The single warm chart WebView, mounted once at the KitProvider level (sibling
 * to the navigator) so route changes never unmount it. It loads the constant
 * unified chart bundle and is repositioned each frame over whichever focused
 * chart host currently owns it (via chartOverlayController), parked offscreen
 * when no chart is on screen. This is the desktop stand-in for native's
 * singleton chart-webview pool.
 */
export function ChartOverlayRoot() {
  // The readiness global arrives via IPC shortly AFTER this root mounts (it's
  // sent on the main window's did-finish-load), and getDesktopOfflineChartReady()
  // is a non-reactive snapshot — so poll briefly until it flips, then mount the
  // warm webview (and prewarm the chart engine before any chart screen opens).
  const [ready, setReady] = useState(() => getDesktopOfflineChartReady());
  useEffect(() => {
    if (ready) return undefined;
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      if (getDesktopOfflineChartReady()) {
        setReady(true);
        clearInterval(timer);
      } else if (tries > 40) {
        // ~20s: assets weren't bundled (no-token build) — stay on online chart.
        clearInterval(timer);
      }
    }, 500);
    return () => clearInterval(timer);
  }, [ready]);

  // Only the app-global params matter here (timezone/locale/theme/...); per-token
  // symbol arrives via SYMBOL_CHANGE, so the URL stays constant across tokens.
  const { params } = useTradingViewUrl();
  const unifiedUrl = useMemo(() => buildUnifiedChartUrl(params), [params]);

  const containerRef = useRef<HTMLDivElement | null>(null);

  const handleWebViewRef = useCallback((ref: IWebViewRef | null) => {
    chartOverlayController.attachWebView(ref);
  }, []);

  const handleReceive = useCallback((data: ICustomReceiveHandlerData) => {
    chartOverlayController.handleMessage(data);
  }, []);

  const handleLoadEnd = useCallback(() => {
    chartOverlayController.handleLoaded();
  }, []);

  // Position the overlay over the active host's placeholder every frame. rAF
  // uniformly absorbs scroll / route transitions / sidebar resize without
  // wiring per-source listeners; the diff guard keeps it allocation-free when
  // nothing moves. Park offscreen (kept alive) when no host is active.
  useEffect(() => {
    if (!ready) return undefined;
    let raf = 0;
    let last = '';
    const tick = () => {
      const el = containerRef.current;
      if (el) {
        const rect = chartOverlayController.getActiveRect();
        if (rect && rect.width > 0 && rect.height > 0) {
          const key = `${rect.left},${rect.top},${rect.width},${rect.height}`;
          if (key !== last) {
            last = key;
            el.style.left = `${rect.left}px`;
            el.style.top = `${rect.top}px`;
            el.style.width = `${rect.width}px`;
            el.style.height = `${rect.height}px`;
            el.style.visibility = 'visible';
            el.style.pointerEvents = 'auto';
          }
        } else if (last !== '') {
          last = '';
          el.style.visibility = 'hidden';
          el.style.pointerEvents = 'none';
          el.style.left = '-99999px';
          el.style.top = '-99999px';
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ready]);

  if (!ready) return null;

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        left: -99_999,
        top: -99_999,
        width: 1,
        height: 1,
        visibility: 'hidden',
        zIndex: OVERLAY_Z_INDEX,
        overflow: 'hidden',
        display: 'flex',
      }}
    >
      <WebView
        // Re-key on app-global changes (theme/locale) so the constant source
        // reloads cleanly; token switches never change the URL.
        key={`chart-overlay:${unifiedUrl}`}
        src={unifiedUrl}
        customReceiveHandler={async (data) => {
          handleReceive(data as ICustomReceiveHandlerData);
        }}
        onWebViewRef={handleWebViewRef}
        onLoadEnd={handleLoadEnd}
        displayProgressBar={false}
        pullToRefreshEnabled={false}
        scrollEnabled={false}
      />
    </div>
  );
}

export default ChartOverlayRoot;
