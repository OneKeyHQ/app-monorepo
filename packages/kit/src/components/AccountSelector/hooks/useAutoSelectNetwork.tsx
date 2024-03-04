import { useEffect } from 'react';

import { useDebugComponentRemountLog } from '@onekeyhq/shared/src/utils/debugUtils';

import {
  useAccountSelectorActions,
  useAccountSelectorStorageReadyAtom,
  useSelectedAccount,
} from '../../../states/jotai/contexts/accountSelector';

import { useAccountSelectorAvailableNetworks } from './useAccountSelectorAvailableNetworks';

export function useAutoSelectNetwork({ num }: { num: number }) {
  const {
    selectedAccount: { networkId },
  } = useSelectedAccount({ num });

  const [isReady] = useAccountSelectorStorageReadyAtom();
  const { networkIds, defaultNetworkId } = useAccountSelectorAvailableNetworks({
    num,
  });

  const actions = useAccountSelectorActions();

  // ** auto select first network if no network selected yet
  useEffect(() => {
    if (!isReady) {
      return;
    }
    if (!networkIds || !networkIds.length) {
      return;
    }
    // TODO move below code to actions
    const network = networkIds.find((item) => item === networkId);
    if (!network || !networkId) {
      let usedNetworkId = networkIds[0];
      if (defaultNetworkId) {
        const founded = networkIds.find((item) => item === defaultNetworkId);
        if (founded) {
          usedNetworkId = defaultNetworkId;
        }
      }
      if (usedNetworkId) {
        void actions.current.updateSelectedAccountNetwork({
          num,
          networkId: usedNetworkId,
        });
      }
    }
  }, [actions, defaultNetworkId, isReady, networkId, networkIds, num]);

  // TODO UI unmount & mount unexpectedly, cause hooks rerun
  // TODO useUpdateEffect()
  // useEffect(() => {
  //   if (!isReady) {
  //     return;
  //   }
  //   void actions.current.autoSelectNetworkOfOthersWalletAccount({
  //     num,
  //     othersWalletAccountId,
  //   });
  // }, [actions, isReady, num, othersWalletAccountId]);

  useDebugComponentRemountLog({ name: 'useNetworkAutoSelect' });
}
