import { useEffect } from 'react';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import {
  useAccountSelectorActions,
  useAccountSelectorSceneInfo,
  useAccountSelectorStorageReadyAtom,
  useActiveAccount,
} from '../../../states/jotai/contexts/accountSelector';

export function useAutoSelectAccount({ num }: { num: number }) {
  const {
    activeAccount: { ready: activeAccountReady, account },
  } = useActiveAccount({ num });
  const [storageReady] = useAccountSelectorStorageReadyAtom();
  const { sceneName, sceneUrl } = useAccountSelectorSceneInfo();

  const actions = useAccountSelectorActions();

  // **** autoSelectAccount onMount
  useEffect(() => {
    if (!storageReady || !activeAccountReady) {
      return;
    }
    void actions.current.autoSelectAccount({ num, sceneName, sceneUrl });
  }, [actions, activeAccountReady, num, sceneName, sceneUrl, storageReady]);

  // **** autoSelectAccount after WalletUpdate
  useEffect(() => {
    const fn = () => {
      if (!account) {
        void actions.current.autoSelectAccount({ num, sceneName, sceneUrl });
      }
    };
    appEventBus.on(EAppEventBusNames.WalletUpdate, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.WalletUpdate, fn);
    };
  }, [account, actions, num, sceneName, sceneUrl]);

  // **** autoSelectAccount after AccountRemove
  useEffect(() => {
    const fn = async () => {
      await actions.current.autoSelectAccount({ num, sceneName, sceneUrl });
    };
    appEventBus.on(EAppEventBusNames.AccountRemove, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.AccountRemove, fn);
    };
  }, [actions, num, sceneName, sceneUrl]);
}
