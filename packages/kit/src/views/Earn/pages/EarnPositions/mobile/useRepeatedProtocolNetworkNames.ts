import { useMemo } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';

import type { IEarnProtocolView } from './earnPositionModel';

/**
 * The network names of the protocol groups whose name repeats in the list
 * (Morpho on Base, Ethereum and Katana), by group key. The network badge on
 * the logo is too small to tell them apart, so the group names its network
 * beside the name, as the wallet's token list does for a token on several
 * networks. A name shown once needs no badge.
 */
export function useRepeatedProtocolNetworkNames(
  protocols: IEarnProtocolView[],
) {
  const repeated = useMemo(() => {
    const countByName = new Map<string, number>();
    protocols.forEach((protocol) => {
      countByName.set(protocol.name, (countByName.get(protocol.name) ?? 0) + 1);
    });
    return protocols.filter(
      (protocol) => (countByName.get(protocol.name) ?? 0) > 1,
    );
  }, [protocols]);

  const networkIdsKey = Array.from(
    new Set(repeated.map((protocol) => protocol.networkId)),
  )
    .toSorted()
    .join(',');
  const { result: networkNames } = usePromiseResult(
    async () => {
      if (!networkIdsKey) {
        return new Map<string, string>();
      }
      const { networks } =
        await backgroundApiProxy.serviceNetwork.getNetworksByIds({
          networkIds: networkIdsKey.split(','),
        });
      return new Map(networks.map((network) => [network.id, network.name]));
    },
    [networkIdsKey],
    { initResult: new Map<string, string>() },
  );

  return useMemo(() => {
    const byKey = new Map<string, string>();
    repeated.forEach((protocol) => {
      const name = networkNames.get(protocol.networkId);
      if (name) {
        byKey.set(protocol.key, name);
      }
    });
    return byKey;
  }, [networkNames, repeated]);
}
