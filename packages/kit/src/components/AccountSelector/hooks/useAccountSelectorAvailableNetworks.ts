import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useAccountSelectorAvailableNetworksAtom } from '../../../states/jotai/contexts/accountSelector';

import type { IAccountSelectorAvailableNetworks } from '../../../states/jotai/contexts/accountSelector';

export function useAccountSelectorAvailableNetworks({
  num,
}: {
  num: number;
}): IAccountSelectorAvailableNetworks {
  const { serviceNetwork } = backgroundApiProxy;
  const [map] = useAccountSelectorAvailableNetworksAtom();
  const availableNetworksInfo = map[num];

  const networkIds: string[] = usePromiseResult(
    async () => {
      if (
        availableNetworksInfo?.networkIds &&
        availableNetworksInfo?.networkIds?.length
      ) {
        return availableNetworksInfo?.networkIds;
      }
      const { networkIds: ids } = await serviceNetwork.getAllNetworkIds();
      return ids;
    },
    [availableNetworksInfo?.networkIds, serviceNetwork],
    {
      initResult: [],
    },
  ).result;

  return {
    networkIds,
    defaultNetworkId: availableNetworksInfo?.defaultNetworkId,
  };
}
