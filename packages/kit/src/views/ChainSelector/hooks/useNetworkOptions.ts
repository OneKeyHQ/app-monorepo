import { useMemo } from 'react';

import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { IServerNetwork } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../../hooks/usePromiseResult';

export function useNetworkOptions(networkIds?: string[]) {
  // Key by content so unstable array identities from callers don't refetch.
  const networkIdsKey = JSON.stringify(networkIds ?? []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableNetworkIds = useMemo(() => networkIds ?? [], [networkIdsKey]);

  const { result, isLoading, run } = usePromiseResult(
    async () => {
      if (!stableNetworkIds.length) {
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
          networks: stableNetworkIds
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
    [stableNetworkIds],
    {
      initResult: {
        networks: [] as IServerNetwork[],
        hasError: false,
      },
      watchLoading: true,
      checkIsFocused: false,
    },
  );

  // Keep the returned object referentially stable so memoized consumers
  // (e.g. task list rows) don't re-render on unrelated parent renders.
  return useMemo(
    () => ({
      networks: result.networks,
      isLoading: !!isLoading,
      hasError: result.hasError,
      retry: run,
    }),
    [result, isLoading, run],
  );
}
