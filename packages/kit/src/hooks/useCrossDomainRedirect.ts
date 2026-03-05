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
 */
export function useCrossDomainRedirect(initialUrl: string, enabled = true) {
  const navigation = useAppNavigation();
  const isUnmounting = useRef(false);

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

  // Desktop: intercept window.open() via Electron IPC.
  // Only close the modal here — useDesktopNewWindow (in DesktopCustomTabBar)
  // already listens to the same global IPC event and opens the URL in Discovery.
  useEffect(() => {
    if (!enabled || !platformEnv.isDesktop) return;
    const handleDesktopNewWindow = (
      _event: unknown,
      data: { url?: string },
    ) => {
      if (isUnmounting.current || !data.url) return;
      if (isCrossDomain(data.url)) {
        navigation.pop();
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
  }, [enabled, isCrossDomain, navigation]);

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

  // Native-only: intercept window.open() popups.
  // On desktop, the IPC handler + useDesktopNewWindow already handle this.
  const onOpenWindow = useCallback(
    (event: { nativeEvent: { targetUrl: string } }) => {
      if (platformEnv.isDesktop) return;
      if (isCrossDomain(event.nativeEvent.targetUrl)) {
        redirectToDiscovery(event.nativeEvent.targetUrl);
      }
    },
    [isCrossDomain, redirectToDiscovery],
  );

  return { onShouldStartLoadWithRequest, onOpenWindow };
}
