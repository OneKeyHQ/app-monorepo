import type { IServerNetwork } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../../hooks/usePromiseResult';

export type IBulkExportHistoryNetworkOption = Pick<
  IServerNetwork,
  'id' | 'name' | 'logoURI' | 'isCustomNetwork' | 'isAllNetworks'
>;

export function useBulkExportHistoryNetworkOptions(networkIds?: string[]) {
  const { result = [], isLoading } = usePromiseResult(
    async () => {
      if (!networkIds?.length) {
        return [] as IBulkExportHistoryNetworkOption[];
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
          .filter((network): network is IServerNetwork => Boolean(network))
          .map((network) => ({
            id: network.id,
            name: network.name,
            logoURI: network.logoURI,
            isCustomNetwork: network.isCustomNetwork,
            isAllNetworks: network.isAllNetworks,
          }));
      } catch {
        return [] as IBulkExportHistoryNetworkOption[];
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
