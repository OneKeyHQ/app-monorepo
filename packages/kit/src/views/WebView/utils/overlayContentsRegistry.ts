/**
 * Module-scoped registry of Electron <webview> contents ids that are owned by
 * the WebView overlay route (vs. the Discovery browser). The desktop main
 * process tags `WEBVIEW_NEW_WINDOW` IPC events with `sourceWebContentsId`;
 * renderer listeners use this registry to route the popup through the right
 * policy:
 *   - overlay-sourced events → strict `isAllowedWebViewUrl` + openUrlExternal
 *   - Discovery-sourced events → existing `validateWebviewSrc` behavior
 *
 * Without the split, an attacker page opened in the overlay could call
 * `window.open('http://localhost/...')` and escape the overlay's stricter
 * policy via Discovery's looser handler.
 */

const overlayContentsIds = new Set<number>();

export function registerOverlayWebContentsId(id: number): () => void {
  overlayContentsIds.add(id);
  return () => {
    overlayContentsIds.delete(id);
  };
}

export function isOverlayWebContentsId(id: number | undefined | null): boolean {
  if (id === undefined || id === null) return false;
  return overlayContentsIds.has(id);
}
