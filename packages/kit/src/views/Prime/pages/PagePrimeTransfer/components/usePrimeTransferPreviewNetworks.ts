import { useMemo } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import type { IPrimeTransferData } from '@onekeyhq/shared/types/prime/primeTransferTypes';

export function usePrimeTransferPreviewNetworks(data: IPrimeTransferData) {
  const networkIds = useMemo(
    () => [
      ...new Set(
        [
          ...Object.values(data.privateData.importedAccounts),
          ...Object.values(data.privateData.watchingAccounts),
        ]
          .map((account) => account.createAtNetwork)
          .filter((id): id is string => !!id),
      ),
    ],
    [data],
  );
  const { result } = usePromiseResult(
    async () =>
      networkIds.length
        ? backgroundApiProxy.serviceNetwork.getNetworksByIds({ networkIds })
        : { networks: [] },
    [networkIds],
  );
  return useMemo<Record<string, IServerNetwork>>(
    () =>
      Object.fromEntries(
        (result?.networks ?? []).map((network) => [network.id, network]),
      ),
    [result],
  );
}
