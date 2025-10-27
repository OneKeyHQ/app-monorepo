import { useEffect } from 'react';

import { useRouteIsFocused as useIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import { EEnterMethod } from '@onekeyhq/shared/src/logger/scopes/discovery/scenes/dapp';
import { getPendingDiscoveryUrl } from '@onekeyhq/shared/src/utils/openUrlUtils';

import { useWebSiteHandler } from './useWebSiteHandler';

/**
 * Hook to handle pending Discovery URLs
 * Checks if there's a pending URL to open when the Discovery tab is focused
 * and automatically opens it in the Discovery browser
 *
 * @example
 * ```tsx
 * function DiscoveryComponent() {
 *   usePendingDiscoveryUrl();
 *   // ... rest of component
 * }
 * ```
 */
export function usePendingDiscoveryUrl() {
  const isFocused = useIsFocused();
  const handleWebSite = useWebSiteHandler();

  useEffect(() => {
    if (isFocused) {
      const pendingUrl = getPendingDiscoveryUrl();
      if (pendingUrl) {
        // Open the URL in Discovery browser
        handleWebSite({
          webSite: {
            url: pendingUrl.url,
            title: pendingUrl.title || pendingUrl.url,
            logo: undefined,
            sortIndex: undefined,
          },
          enterMethod: EEnterMethod.externalNavigation,
          shouldPopNavigation: false,
        });
      }
    }
  }, [isFocused, handleWebSite]);
}
