import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { IServerNetwork } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../../hooks/usePromiseResult';

export function useNetworkOptions(networkIds?: string[]) {
  const networkIdsKey = JSON.stringify(networkIds ?? []);
  const { result, isLoading, run } = usePromiseResult(
    async () => {
      const currentNetworkIds = JSON.parse(networkIdsKey) as string[];
      if (!currentNetworkIds.length) {
        return {
          networks: [] as IServerNetwork[],
          hasError: false,
        };
      }

      try {
        const { networks } =
          await backgroundApiProxy.serviceNetwork.getAllNetworks({
            excludeAllNetworkItem: true,
          });

        const networkMap = new Map(
          networks.map((network) => [network.id, network]),
        );

        return {
          networks: currentNetworkIds
            .map((networkId) => networkMap.get(networkId))
            .filter((network): network is IServerNetwork => Boolean(network)),
          hasError: false,
        };
      } catch (error) {
        defaultLogger.app.error.log(
          `Failed to load network options: ${String(error)}`,
        );
        return {
          networks: [] as IServerNetwork[],
          hasError: true,
        };
      }
    },
    [networkIdsKey],
    {
      initResult: {
        networks: [] as IServerNetwork[],
        hasError: false,
      },
      watchLoading: true,
      checkIsFocused: false,
    },
  );

  return {
    networks: result.networks,
    isLoading: !!isLoading,
    hasError: result.hasError,
    retry: run,
  };
}
