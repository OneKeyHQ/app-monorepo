import { useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import { NetworkStatusBadge, useOnRouterChange } from '@onekeyhq/components';
import { useNetInfo } from '@onekeyhq/components/src/hooks/useNetInfo';
import { usePerpsNetworkStatusAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ERootRoutes, ETabRoutes } from '@onekeyhq/shared/src/routes';

export function NetworkStatus() {
  const intl = useIntl();
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

  const isInPerpRoute =
    currentTab === ETabRoutes.Perp ||
    currentTab === ETabRoutes.WebviewPerpTrade;

  // Determine network status based on current tab
  const isConnected = useMemo(() => {
    if (isInPerpRoute) {
      return Boolean(perpsNetworkStatus?.connected);
    }
    return isInternetReachable !== false;
  }, [isInPerpRoute, perpsNetworkStatus?.connected, isInternetReachable]);

  // Show ping latency in badge label when on Perp tab
  const label = useMemo(() => {
    if (
      isInPerpRoute &&
      isConnected &&
      perpsNetworkStatus?.pingMs !== null &&
      perpsNetworkStatus?.pingMs !== undefined
    ) {
      return `${intl.formatMessage({ id: ETranslations.perp_online })} ${perpsNetworkStatus.pingMs}ms`;
    }
    return undefined;
  }, [isInPerpRoute, isConnected, perpsNetworkStatus?.pingMs, intl]);

  return (
    <NetworkStatusBadge connected={isConnected} badgeSize="sm" label={label} />
  );
}
