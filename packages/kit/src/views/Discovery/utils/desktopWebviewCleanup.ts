import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { webviewRefs } from './explorerUtils';

// Drop the Electron <webview> ref for a closed or LRU-evicted tab.
//
// We deliberately do NOT try to clear timers/media/DevTools here. By the time
// this runs (a passive effect on eviction, or the unmount cleanup on close)
// React has already unmounted the <webview>, so any executeJavaScript / stop /
// closeDevTools call would target a detached node, throw, and be swallowed — it
// never actually ran. The real reclamation comes for free from unmounting the
// <webview>, which destroys its guest renderer process and releases all of its
// timers, media and GPU memory. The only thing still worth doing is dropping
// the ref so it can be garbage collected.
// IMPORTANT: never clear the shared session cache/storage here — all webviews
// share partition="persist:onekey", so that would wipe other open tabs.
export function releaseDesktopWebviewResources(id: string): void {
  if (!platformEnv.isDesktop) {
    return;
  }
  // Drop the ref so the (already unmounted) webview can be garbage collected.
  delete webviewRefs[id];
}
