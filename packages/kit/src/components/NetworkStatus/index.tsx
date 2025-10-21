import { useMemo, useState } from 'react';

import { NetworkStatusBadge, useOnRouterChange } from '@onekeyhq/components';
import { useNetInfo } from '@onekeyhq/components/src/hooks/useNetInfo';
import { usePerpsNetworkStatusAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ERootRoutes, ETabRoutes } from '@onekeyhq/shared/src/routes';

export function NetworkStatus() {
  const { isInternetReachable } = useNetInfo();
  const [currentTab, setCurrentTab] = useState<ETabRoutes | null>(null);
  const [perpsNetworkStatus] = usePerpsNetworkStatusAtom();

  // Track current tab for perps network status
  useOnRouterChange((state) => {
    if (!state) {
      setCurrentTab(ETabRoutes.Home);
      return;
    }
    const rootState = state?.routes.find(
      ({ name }) => name === ERootRoutes.Main,
    )?.state;
    const currentTabName = rootState?.routeNames
      ? (rootState?.routeNames?.[rootState?.index || 0] as ETabRoutes)
      : (rootState?.routes[0].name as ETabRoutes);
    setCurrentTab(currentTabName);
  });

  // Determine network status based on current tab
  const isConnected = useMemo(() => {
    // If in perps page, use perps network status
    if (
      currentTab === ETabRoutes.Perp ||
      currentTab === ETabRoutes.WebviewPerpTrade
    ) {
      return Boolean(perpsNetworkStatus?.connected);
    }
    // Otherwise use default network status
    return isInternetReachable !== false;
  }, [currentTab, perpsNetworkStatus?.connected, isInternetReachable]);

  return <NetworkStatusBadge connected={isConnected} badgeSize="sm" />;
}
