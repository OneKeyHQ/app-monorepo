/* eslint-disable @typescript-eslint/no-unsafe-call */
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { webviewRefs } from './explorerUtils';

// Aggressively release an Electron <webview>'s resources, then drop its ref.
//
// Runs both when a tab is closed and when the keep-alive LRU evicts a tab, so a
// long-running DApp can't leak timers/media/GPU memory into the shared process.
// IMPORTANT: never clear the shared session cache/storage here — all webviews
// share partition="persist:onekey", so that would wipe other open tabs.
export function releaseDesktopWebviewResources(id: string): void {
  if (!platformEnv.isDesktop) {
    return;
  }
  const webview = webviewRefs[id]?.innerRef as any;
  if (webview) {
    try {
      // Clear all JS timers/intervals + animation frames — the main cause of
      // OOM in long-lived DApp sessions.
      if (typeof webview.executeJavaScript === 'function') {
        void webview.executeJavaScript(`
          try {
            const maxId = setTimeout(() => {}, 0);
            for (let i = 0; i < maxId; i++) {
              clearInterval(i);
              clearTimeout(i);
            }
            let rafId = requestAnimationFrame(() => {});
            while (rafId--) {
              cancelAnimationFrame(rafId);
            }
          } catch (e) {
            console.error('[Memory Cleanup] Failed to clear timers:', e);
          }
        `);
      }
      // Stop media playback (audio/video).
      if (typeof webview.stop === 'function') {
        webview.stop();
      }
      // Close DevTools to release GPU memory.
      if (typeof webview.closeDevTools === 'function') {
        webview.closeDevTools();
      }
      // Clear in-memory navigation history for this webview.
      if (typeof webview.clearHistory === 'function') {
        webview.clearHistory();
      }
    } catch (error) {
      console.error(`[Memory Cleanup] Failed to cleanup tab ${id}:`, error);
    }
  }
  // Drop the ref so the webview can be garbage collected.
  delete webviewRefs[id];
}
