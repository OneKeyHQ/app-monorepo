import { useCallback, useEffect, useMemo, useRef } from 'react';

import { ipcMessageKeys } from '@onekeyhq/desktop/app/config';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { openUrlInDiscovery } from '@onekeyhq/shared/src/utils/openUrlUtils';

import useAppNavigation from './useAppNavigation';

/**
 * Hook that intercepts cross-domain navigation in a WebView and redirects
 * them to the Discovery browser. Handles three interception mechanisms:
 *
 * - Desktop IPC: Electron main process intercepts window.open() and sends
 *   the URL via WEBVIEW_NEW_WINDOW IPC event
 * - Native onShouldStartLoadWithRequest: intercepts top-frame navigation
 * - Native onOpenWindow: intercepts window.open() popups
 *
 * On Desktop, window.open() fires BOTH a webview 'new-window' DOM event
 * (handled by onOpenWindow via handleNewWindow) AND an IPC event. We use
 * a ref guard to ensure only the first handler to fire actually redirects,
 * preventing duplicate Discovery tabs.
 */
export function useCrossDomainRedirect(initialUrl: string, enabled = true) {
  const navigation = useAppNavigation();
  const isUnmounting = useRef(false);
  // Guard: on desktop, onOpenWindow (sync) fires before the IPC handler (async).
  // The first handler sets this flag so the second one skips.
  const desktopHandledRef = useRef(false);

  useEffect(
    () => () => {
      isUnmounting.current = true;
    },
    [],
  );

  const initialHost = useMemo(() => {
    try {
      return new URL(initialUrl).hostname;
    } catch {
      return '';
    }
  }, [initialUrl]);

  const isCrossDomain = useCallback(
    (targetUrl: string) => {
      try {
        const targetHost = new URL(targetUrl).hostname;
        return !!(targetHost && initialHost && targetHost !== initialHost);
      } catch {
        return false;
      }
    },
    [initialHost],
  );

  const redirectToDiscovery = useCallback(
    (targetUrl: string) => {
      openUrlInDiscovery({ url: targetUrl });
      navigation.pop();
    },
    [navigation],
  );

  // Desktop: intercept window.open() via Electron IPC (async fallback).
  // On desktop, onOpenWindow fires first (sync via 'new-window' DOM event).
  // This IPC handler acts as a fallback — it only redirects if onOpenWindow
  // didn't already handle the event (checked via desktopHandledRef).
  useEffect(() => {
    if (!enabled || !platformEnv.isDesktop) return;
    const handleDesktopNewWindow = (
      _event: unknown,
      data: { url?: string },
    ) => {
      if (isUnmounting.current || !data.url) return;
      if (isCrossDomain(data.url)) {
        if (desktopHandledRef.current) {
          desktopHandledRef.current = false;
          return;
        }
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
  }, [enabled, isCrossDomain, redirectToDiscovery]);

  // Native: intercept top-frame navigation
  const onShouldStartLoadWithRequest = useCallback(
    (event: { url: string; isTopFrame?: boolean }) => {
      if (!event.isTopFrame) return true;
      if (isCrossDomain(event.url)) {
        redirectToDiscovery(event.url);
        return false;
      }
      return true;
    },
    [isCrossDomain, redirectToDiscovery],
  );

  // Intercept window.open() popups (all platforms).
  // On desktop, this fires synchronously via the webview 'new-window' DOM event
  // (before the async IPC handler). Sets desktopHandledRef so the IPC handler skips.
  const onOpenWindow = useCallback(
    (event: { nativeEvent: { targetUrl: string } }) => {
      if (isCrossDomain(event.nativeEvent.targetUrl)) {
        if (platformEnv.isDesktop) {
          desktopHandledRef.current = true;
        }
        redirectToDiscovery(event.nativeEvent.targetUrl);
      }
    },
    [isCrossDomain, redirectToDiscovery],
  );

  return { onShouldStartLoadWithRequest, onOpenWindow };
}
