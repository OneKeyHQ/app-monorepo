import { useCallback, useEffect } from 'react';

import { ipcMessageKeys } from '@onekeyhq/desktop/app/config';

import { useCrossDomainCore } from './crossDomainRedirectUtils';

import type { ICrossDomainRedirectResult } from './crossDomainRedirectUtils';

/**
 * Cross-domain redirect hook — Electron Desktop implementation.
 * Intercepts navigation via onShouldStartLoadWithRequest and
 * window.open() popups via WEBVIEW_NEW_WINDOW IPC listener.
 */
export function useCrossDomainRedirect(
  initialUrl: string,
  enabled = true,
): ICrossDomainRedirectResult {
  const { isCrossDomain, redirectToDiscovery, isUnmounting } =
    useCrossDomainCore(initialUrl);

  // Desktop: intercept window.open() via Electron IPC
  useEffect(() => {
    if (!enabled) return;
    const handleDesktopNewWindow = (
      _event: unknown,
      data: { url?: string },
    ) => {
      if (isUnmounting.current || !data.url) return;
      if (isCrossDomain(data.url)) {
        redirectToDiscovery(data.url);
      }
    };
    globalThis.desktopApi?.addIpcEventListener(
      ipcMessageKeys.WEBVIEW_NEW_WINDOW,
      handleDesktopNewWindow,
    );
    return () => {
      globalThis.desktopApi?.removeIpcEventListener(
        ipcMessageKeys.WEBVIEW_NEW_WINDOW,
        handleDesktopNewWindow,
      );
    };
  }, [enabled, isCrossDomain, redirectToDiscovery, isUnmounting]);

  const onShouldStartLoadWithRequest = useCallback(
    (event: { url: string; isTopFrame?: boolean }) => {
      if (!enabled) return true;
      if (!event.isTopFrame) return true;
      if (isCrossDomain(event.url)) {
        redirectToDiscovery(event.url);
        return false;
      }
      return true;
    },
    [enabled, isCrossDomain, redirectToDiscovery],
  );

  const onOpenWindow = useCallback(
    (event: { nativeEvent: { targetUrl: string } }) => {
      if (!enabled) return;
      if (isCrossDomain(event.nativeEvent.targetUrl)) {
        redirectToDiscovery(event.nativeEvent.targetUrl);
      }
    },
    [enabled, isCrossDomain, redirectToDiscovery],
  );

  return { onShouldStartLoadWithRequest, onOpenWindow };
}
