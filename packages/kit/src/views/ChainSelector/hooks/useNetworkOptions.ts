import type { IServerNetwork } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../../hooks/usePromiseResult';

export function useNetworkOptions(networkIds?: string[]) {
  const { result = [], isLoading } = usePromiseResult(
    async () => {
      if (!networkIds?.length) {
        return [] as IServerNetwork[];
      }

      try {
        const { networks } =
          await backgroundApiProxy.serviceNetwork.getAllNetworks({
            excludeAllNetworkItem: true,
          });

        const networkMap = new Map(
          networks.map((network) => [network.id, network]),
        );

        return networkIds
          .map((networkId) => networkMap.get(networkId))
          .filter((network): network is IServerNetwork => Boolean(network));
      } catch {
        return [] as IServerNetwork[];
      }
    },
    [networkIds],
    {
      initResult: [],
      watchLoading: true,
      checkIsFocused: false,
    },
  );

  return {
    networks: result,
    isLoading: !!isLoading,
  };
}
