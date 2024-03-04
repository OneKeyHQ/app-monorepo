import { useEffect } from 'react';

import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import {
  useAccountSelectorActions,
  useAccountSelectorSceneInfo,
  useAccountSelectorStorageReadyAtom,
  useActiveAccount,
} from '../../../states/jotai/contexts/accountSelector';

export function useAutoSelectDeriveType({ num }: { num: number }) {
  const {
    activeAccount: { deriveInfo, network, isOthersWallet },
  } = useActiveAccount({ num });
  const actions = useAccountSelectorActions();
  const [isReady] = useAccountSelectorStorageReadyAtom();
  const { serviceNetwork, serviceAccountSelector } = backgroundApiProxy;
  const networkId = network?.id;
  const { sceneName, sceneUrl } = useAccountSelectorSceneInfo();

  // **** auto select derive type from global when network changed
  useEffect(() => {
    void (async () => {
      if (!isReady || !networkId || isOthersWallet) {
        return;
      }
      await actions.current.syncLocalDeriveTypeFromGlobal({
        num,
        sceneName,
        sceneUrl,
      });
    })();
  }, [actions, isOthersWallet, isReady, networkId, num, sceneName, sceneUrl]);

  // **** auto select first derive type of network
  useEffect(() => {
    void (async () => {
      if (!isReady || !networkId || isOthersWallet) {
        return;
      }
      let newDeriveType: IAccountDeriveTypes | undefined;
      const deriveInfoItems = await serviceNetwork.getDeriveInfoItemsOfNetwork({
        networkId,
      });

      if (!deriveInfo && deriveInfoItems.length > 0) {
        const selectedAccount = actions.current.getSelectedAccount({
          num,
        });
        const globalDeriveType =
          await serviceAccountSelector.getGlobalDeriveType({
            selectedAccount,
          });
        newDeriveType =
          globalDeriveType ||
          (deriveInfoItems?.[0]?.value as IAccountDeriveTypes) ||
          'default';
      }

      if (newDeriveType) {
        await actions.current.updateSelectedAccountDeriveType({
          num,
          deriveType: newDeriveType || 'default',
        });
      }
    })();
  }, [
    actions,
    deriveInfo,
    isOthersWallet,
    isReady,
    networkId,
    num,
    serviceAccountSelector,
    serviceNetwork,
  ]);

  // ******** two way sync with global derive type

  // **** selectedAccount.deriveType -> globalDeriveType
  //      (use actions.current.saveToStorage instead, useEffect cause infinite loop)

  // **** globalDeriveType -> selectedAccount.deriveType
  useEffect(() => {
    if (!isReady || isOthersWallet) {
      return;
    }
    const fn = () =>
      actions.current.syncLocalDeriveTypeFromGlobal({
        num,
        sceneName,
        sceneUrl,
      });
    appEventBus.on(EAppEventBusNames.GlobalDeriveTypeUpdate, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.GlobalDeriveTypeUpdate, fn);
    };
  }, [actions, isOthersWallet, isReady, num, sceneName, sceneUrl]);
}
