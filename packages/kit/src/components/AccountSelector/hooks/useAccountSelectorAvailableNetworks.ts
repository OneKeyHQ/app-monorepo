import { useEffect } from 'react';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

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

  const { result: networkIds, run } = usePromiseResult(
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
  );

  useEffect(() => {
    const refreshNetworkIds = async () => {
      void run({ alwaysSetState: true });
    };
    appEventBus.on(EAppEventBusNames.AddedCustomNetwork, refreshNetworkIds);
    return () => {
      appEventBus.off(EAppEventBusNames.AddedCustomNetwork, refreshNetworkIds);
    };
  }, [run]);

  return {
    networkIds,
    defaultNetworkId: availableNetworksInfo?.defaultNetworkId,
  };
}
