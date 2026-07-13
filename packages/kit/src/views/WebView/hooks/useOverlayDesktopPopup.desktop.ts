import { useEffect } from 'react';

import { EDesktopIpcChannel } from '@onekeyhq/shared/src/consts/desktopIpcChannels';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import { isAllowedWebViewUrl } from '@onekeyhq/shared/src/utils/webViewUrlSafety';

import type { IUseOverlayDesktopPopupArgs } from './useOverlayDesktopPopup';

/**
 * Desktop overlay popup listener.
 *
 * Electron's main process broadcasts `WEBVIEW_NEW_WINDOW` for every
 * `<webview>` that calls `window.open`; the payload includes
 * `sourceWebContentsId`. The overlay handles its own popups (system
 * browser via `openUrlExternal` after `isAllowedWebViewUrl`) and
 * Discovery's listener skips events whose source is in the
 * overlay-contents registry.
 *
 * Main-process pre-navigation guards (`will-redirect` / `will-navigate`)
 * recognize overlay webviews via their dedicated partition, so this hook
 * is no longer responsible for registering the contents id with main.
 */
export function useOverlayDesktopPopup({
  webContentsId,
}: IUseOverlayDesktopPopupArgs): void {
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
