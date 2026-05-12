import { useEffect } from 'react';

import { EDesktopIpcChannel } from '@onekeyhq/shared/src/consts/desktopIpcChannels';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import { isAllowedWebViewUrl } from '@onekeyhq/shared/src/utils/webViewUrlSafety';

import type { IUseOverlayDesktopPopupArgs } from './useOverlayDesktopPopup';

/**
 * Desktop overlay popup listener + main-process overlay registration.
 *
 * Two responsibilities, kept together so registration and listener share
 * the same contents-id lifecycle:
 *
 *   1. Popup IPC: Electron's main process broadcasts `WEBVIEW_NEW_WINDOW`
 *      for every `<webview>` that calls `window.open`; the payload
 *      includes `sourceWebContentsId`. The overlay handles its own popups
 *      (system browser via `openUrlExternal` after `isAllowedWebViewUrl`)
 *      and Discovery's listener skips events whose source is in the
 *      overlay-contents registry.
 *
 *   2. Pre-navigation guard registration: the overlay's contents id is
 *      reported to main via `webviewOverlayRegister` so main-process
 *      `will-redirect` / `will-navigate` handlers can `preventDefault()`
 *      SSRF-class targets BEFORE the network request is sent. The
 *      renderer-side `did-redirect-navigation` callback fires too late
 *      for SSRF; the main-process guard is the load-bearing defense.
 */
export function useOverlayDesktopPopup({
  webContentsId,
}: IUseOverlayDesktopPopupArgs): void {
  // Mirror the contents id to the main-process overlay registry as soon as
  // the owning page captures it. Sending the IPC synchronously from the
  // effect (no polling) minimizes the window between `did-start-navigation`
  // and the main-process pre-nav guard becoming active for this contents id.
  useEffect(() => {
    if (webContentsId === null) return;
    globalThis.desktopApi?.webviewOverlayRegister?.(webContentsId);
    return () => {
      globalThis.desktopApi?.webviewOverlayUnregister?.(webContentsId);
    };
  }, [webContentsId]);

  useEffect(() => {
    const handler = (data: { url?: string; sourceWebContentsId?: number }) => {
      const targetUrl = data?.url;
      if (!targetUrl) return;
      if (webContentsId === null) return;
      if (data.sourceWebContentsId !== webContentsId) return;
      if (!isAllowedWebViewUrl(targetUrl)) return;
      openUrlExternal(targetUrl);
    };
    const unsubscribe = globalThis.desktopApi?.addIpcEventListener(
      EDesktopIpcChannel.WEBVIEW_NEW_WINDOW,
      handler,
    );
    return () => {
      unsubscribe?.();
    };
  }, [webContentsId]);
}
