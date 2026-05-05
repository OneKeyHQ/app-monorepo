import { useCallback } from 'react';

import { useCrossDomainCore } from './crossDomainRedirectUtils';

import type { ICrossDomainRedirectResult } from './crossDomainRedirectUtils';

/**
 * Cross-domain redirect hook — React Native implementation.
 * Intercepts top-frame navigation and window.open() popups,
 * redirecting cross-domain URLs to the Discovery browser.
 */
export function useCrossDomainRedirect(
  initialUrl: string,
  enabled = true,
): ICrossDomainRedirectResult {
  const { isCrossDomain, redirectToDiscovery } = useCrossDomainCore(initialUrl);

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
