import { useCallback, useEffect } from 'react';

import { useRouteIsFocused as useIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EEnterMethod } from '@onekeyhq/shared/src/logger/scopes/discovery/scenes/dapp';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { getPendingDiscoveryUrl } from '@onekeyhq/shared/src/utils/openUrlUtils';

import { useWebSiteHandler } from './useWebSiteHandler';

/**
 * Hook to handle pending Discovery URLs
 *
 * On native: Listens for SwitchDiscoveryTabInNative event to consume pending URLs.
 *   NOTE: Do NOT rely on isFocused on native. The custom native bottom tab navigator
 *   (@onekeyfe/react-native-tab-view) does not properly dispatch focus/blur events
 *   to React Navigation, so useIsFocused() always returns true and never transitions
 *   back to false when the user switches away from the Discovery tab.
 *
 * On desktop: Uses isFocused changes to consume pending URLs,
 *   since SwitchDiscoveryTabInNative event is not emitted on desktop.
 */
export function usePendingDiscoveryUrl() {
  const isFocused = useIsFocused();
  const handleWebSite = useWebSiteHandler();

  const consumePendingUrl = useCallback(() => {
    const pendingUrl = getPendingDiscoveryUrl();
    if (pendingUrl) {
      handleWebSite({
        webSite: {
          url: pendingUrl.url,
          title: pendingUrl.title || pendingUrl.url,
          logo: undefined,
          sortIndex: undefined,
        },
        enterMethod: EEnterMethod.externalNavigation,
      });
    }
  }, [handleWebSite]);

  // Desktop: consume pending URL when Discovery tab gains focus
  useEffect(() => {
    if (!platformEnv.isNative && isFocused) {
      consumePendingUrl();
    }
  }, [isFocused, consumePendingUrl]);

  // Native: consume pending URL via event (isFocused is unreliable on native)
  useEffect(() => {
    if (!platformEnv.isNative) {
      return;
    }

    // Consume any pending URL on initial mount
    consumePendingUrl();

    // Wait for native tab transition animation to complete before consuming
    // the pending URL. Without this, RNSScreenStack may lose its window
    // reference during the transition, causing the browser overlay to not
    // render until the user touches the screen (iOS window-nil freeze).
    const handler = ({ openUrl }: { openUrl?: boolean }) => {
      if (openUrl) {
        requestIdleCallback(() => {
          consumePendingUrl();
        });
      }
    };
    appEventBus.on(EAppEventBusNames.SwitchDiscoveryTabInNative, handler);
    return () => {
      appEventBus.off(EAppEventBusNames.SwitchDiscoveryTabInNative, handler);
    };
  }, [consumePendingUrl]);
}
