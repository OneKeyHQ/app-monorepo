import { useMemo } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';

import { useMarketBasicConfig } from './useMarketBasicConfig';

export function useMarketNetworks() {
  const { networkList, isLoading: isConfigLoading } = useMarketBasicConfig();

  const sortedNetworkList = useMemo(
    () => [...networkList].sort((a, b) => a.index - b.index),
    [networkList],
  );

  const networkIds = useMemo(
    () =>
      sortedNetworkList
        .map((configNetwork) => configNetwork.networkId)
        .filter(Boolean),
    [sortedNetworkList],
  );

  const { result: allNetworks = [], isLoading: isServerNetworksLoading } =
    usePromiseResult(
      async () => {
        const { networks } =
          await backgroundApiProxy.serviceNetwork.getAllNetworks();
        return networks;
      },
      [],
      {
        initResult: [] as IServerNetwork[],
        watchLoading: true,
      },
    );

  const marketNetworks: IServerNetwork[] = useMemo(() => {
    if (!networkIds.length) {
      return [];
    }
    const networkMap = new Map(allNetworks.map((n) => [n.id, n]));
    return networkIds
      .map((networkId) => {
        const networkInfo = networkMap.get(networkId);
        if (networkInfo) {
          return networkInfo;
        }
        const fallback = networkUtils.getLocalNetworkInfo(networkId);
        if (!fallback) {
          return null;
        }
        const configInfo = sortedNetworkList.find(
          (item) => item.networkId === networkId,
        );
        if (configInfo) {
          return {
            ...fallback,
            name: configInfo.name ?? fallback.name,
            logoURI: configInfo.logoUrl ?? fallback.logoURI,
          };
        }
        return fallback;
      })
      .filter(Boolean);
  }, [allNetworks, networkIds, sortedNetworkList]);

  const isLoading = isConfigLoading || Boolean(isServerNetworksLoading);

  return {
    marketNetworks,
    isLoading,
  };
}
