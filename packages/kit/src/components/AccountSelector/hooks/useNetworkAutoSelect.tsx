import { useEffect } from 'react';

import {
  useAccountSelectorActions,
  useAccountSelectorContextData,
  useAccountSelectorStorageReadyAtom,
  useSelectedAccount,
} from '../../../states/jotai/contexts/accountSelector';

import { useAccountSelectorAvailableNetworks } from './useAccountSelectorAvailableNetworks';

export function useNetworkAutoSelect({ num }: { num: number }) {
  const {
    selectedAccount: { networkId },
  } = useSelectedAccount({ num });
  const [isReady] = useAccountSelectorStorageReadyAtom();
  const { config } = useAccountSelectorContextData();
  const networks = useAccountSelectorAvailableNetworks();
  const defaultNetworkId = config?.defaultNetworkId;

  const actions = useAccountSelectorActions();
  useEffect(() => {
    if (!isReady) {
      return;
    }
    if (!networks || !networks.length) {
      return;
    }
    // TODO move below code to actions
    const network = networks.find((item) => item.id === networkId);
    if (!network || !networkId) {
      let usedNetworkId = networks[0].id;
      if (defaultNetworkId) {
        const founded = networks.find((item) => item.id === defaultNetworkId);
        if (founded) {
          usedNetworkId = defaultNetworkId;
        }
      }
      if (usedNetworkId) {
        actions.current.updateSelectedAccount({
          num,
          builder: (v) => ({
            ...v,
            // TODO auto select from home network
            networkId: usedNetworkId,
          }),
        });
      }
    }
  }, [actions, defaultNetworkId, isReady, networkId, networks, num]);
}
