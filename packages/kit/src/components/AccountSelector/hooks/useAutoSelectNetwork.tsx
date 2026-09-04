import { useEffect } from 'react';

import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { useDebugComponentRemountLog } from '@onekeyhq/shared/src/utils/debug/debugUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import {
  useAccountSelectorSceneInfo,
  useAccountSelectorStorageReadyAtom,
  useSelectedAccount,
} from '../../../states/jotai/contexts/accountSelector';
import { useAccountSelectorActions } from '../../../states/jotai/contexts/accountSelector/actions';
import { isAccountSelectorPerfDebugEnabled } from '../../../states/jotai/contexts/accountSelector/perfDebug';

import { useAccountSelectorAvailableNetworks } from './useAccountSelectorAvailableNetworks';

export function useAutoSelectNetwork({ num }: { num: number }) {
  const { selectedAccount } = useSelectedAccount({ num });
  const { networkId } = selectedAccount;

  const [isReady] = useAccountSelectorStorageReadyAtom();
  const { networkIds, defaultNetworkId } = useAccountSelectorAvailableNetworks({
    consumer: 'auto-select-network',
    num,
  });

  const { sceneName } = useAccountSelectorSceneInfo();

  const actions = useAccountSelectorActions();

  if (sceneName === EAccountSelectorSceneName.discover) {
    // console.log('useAutoSelectNetwork::: sceneName', {
    //   selectedAccount,
    //   sceneName,
    //   sceneUrl,
    //   networkId,
    //   networkIds,
    //   defaultNetworkId,
    //   isReady,
    //   num,
    // });
  }

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

      if (
        usedNetworkId &&
        sceneName === EAccountSelectorSceneName.discover &&
        networkUtils.isAllNetwork({ networkId: usedNetworkId })
      ) {
        usedNetworkId = '';
      }

      if (usedNetworkId) {
        if (isAccountSelectorPerfDebugEnabled()) {
          defaultLogger.accountSelector.perf.trace('autoSelectNetwork', {
            networkId: usedNetworkId,
            num,
            sceneName,
          });
        }

        void actions.current.updateSelectedAccountNetwork({
          num,
          networkId: usedNetworkId,
          reason: 'autoSelectNetwork',
        });
      }
    }
  }, [
    actions,
    defaultNetworkId,
    isReady,
    networkId,
    networkIds,
    num,
    sceneName,
  ]);

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

  useDebugComponentRemountLog({ name: `useNetworkAutoSelect:${num}` });
}
