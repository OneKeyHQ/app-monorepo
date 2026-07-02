import { useMemo } from 'react';

import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';

import { fetchMarketAllNetworksForPlatform } from './fetchMarketAllNetworksForPlatform';
import { resolveMarketNetworkFromConfig } from './marketNetworkUtils';
import { useMarketBasicConfig } from './useMarketBasicConfig';

export function useMarketNetworks() {
  const { networkList, isLoading: isConfigLoading } = useMarketBasicConfig();

  const sortedNetworkList = useMemo(
    () => networkList.toSorted((a, b) => a.index - b.index),
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
        return fetchMarketAllNetworksForPlatform();
      },
      [],
      {
        initResult: [] as IServerNetwork[],
        watchLoading: true,
        revalidateOnReconnect: true,
      },
    );

  const marketNetworks: IServerNetwork[] = useMemo(() => {
    if (!networkIds.length) {
      return [];
    }
    const networkMap = new Map(allNetworks.map((n) => [n.id, n]));
    const networks = networkIds
      .map((networkId) => {
        const configInfo = sortedNetworkList.find(
          (item) => item.networkId === networkId,
        );
        if (configInfo) {
          return resolveMarketNetworkFromConfig({
            configNetwork: configInfo,
            networkInfo:
              networkMap.get(networkId) ??
              networkUtils.getLocalNetworkInfo(networkId),
          });
        }
        return (
          networkMap.get(networkId) ??
          networkUtils.getLocalNetworkInfo(networkId) ??
          null
        );
      })
      .filter(Boolean);

    // Add "All Networks" option at the first position
    const allNetworkId = getNetworkIdsMap().onekeyall;
    const allNetworkInfo = networkMap.get(allNetworkId);
    if (allNetworkInfo) {
      return [allNetworkInfo, ...networks];
    }
    // Fallback to local network info if not found in allNetworks
    const allNetworkFallback = networkUtils.getLocalNetworkInfo(allNetworkId);
    if (allNetworkFallback) {
      return [allNetworkFallback, ...networks];
    }
    return networks;
  }, [allNetworks, networkIds, sortedNetworkList]);

  const isLoading = isConfigLoading || Boolean(isServerNetworksLoading);

  return {
    marketNetworks,
    isLoading,
  };
}
