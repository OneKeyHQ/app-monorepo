import { useCallback, useEffect, useMemo, useRef } from 'react';

import { openUrlInDiscovery } from '@onekeyhq/shared/src/utils/openUrlUtils';

import useAppNavigation from './useAppNavigation';

export interface ICrossDomainRedirectResult {
  onShouldStartLoadWithRequest:
    | ((event: { url: string; isTopFrame?: boolean }) => boolean)
    | undefined;
  onOpenWindow:
    | ((event: { nativeEvent: { targetUrl: string } }) => void)
    | undefined;
}

/**
 * Shared core logic for cross-domain redirect.
 * Platform-specific hooks compose on top of this.
 */
export function useCrossDomainCore(initialUrl: string) {
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

  return { isCrossDomain, redirectToDiscovery, isUnmounting };
}
