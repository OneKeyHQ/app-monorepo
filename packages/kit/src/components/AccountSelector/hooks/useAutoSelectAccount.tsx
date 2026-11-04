import { useEffect } from 'react';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import {
  EAccountSelectorAutoSelectTriggerBy,
  EAccountSelectorSceneName,
} from '@onekeyhq/shared/types';

import {
  useAccountSelectorSceneInfo,
  useAccountSelectorStorageReadyAtom,
  useActiveAccount,
} from '../../../states/jotai/contexts/accountSelector';
import { useAccountSelectorActions } from '../../../states/jotai/contexts/accountSelector/actions';
import { deferHeavyWorkUntilUIIdle } from '../../../utils/deferHeavyWork';

export function useAutoSelectAccount({ num }: { num: number }) {
  const {
    activeAccount: { ready: activeAccountReady },
  } = useActiveAccount({ num });
  const [storageReady] = useAccountSelectorStorageReadyAtom();
  const { sceneName, sceneUrl } = useAccountSelectorSceneInfo();

  const actions = useAccountSelectorActions();

  // **** autoSelectAccount onMount
  useEffect(() => {
    if (!storageReady || !activeAccountReady) {
      return;
    }
    let cancelled = false;
    const run = async () => {
      if (sceneName === EAccountSelectorSceneName.home) {
        await deferHeavyWorkUntilUIIdle();
        if (cancelled) return;
      }
      await actions.current.autoSelectNextAccount({
        num,
        sceneName,
        sceneUrl,
        source: 'active-ready',
      });
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [actions, activeAccountReady, num, sceneName, sceneUrl, storageReady]);

  // **** autoSelectAccount after WalletUpdate
  useEffect(() => {
    const fn = async () => {
      const settledForMs = 600;
      await timerUtils.wait(settledForMs);
      const latestActiveAccount = actions.current.getActiveAccount({ num });
      if (latestActiveAccount.account && latestActiveAccount.wallet) {
        return;
      }
      await actions.current.autoSelectNextAccount({
        num,
        sceneName,
        sceneUrl,
        settledForMs,
        source: 'wallet-update',
      });
    };
    appEventBus.on(EAppEventBusNames.WalletUpdate, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.WalletUpdate, fn);
    };
  }, [actions, num, sceneName, sceneUrl]);

  // **** autoSelectAccount after WalletRemove
  useEffect(() => {
    const fn = async ({ walletId }: { walletId: string }) => {
      // Do not rebind a DApp connection during wallet cleanup.
      if (sceneName === EAccountSelectorSceneName.discover) {
        return;
      }
      await actions.current.autoSelectNextAccount({
        num,
        sceneName,
        sceneUrl,
        triggerBy: EAccountSelectorAutoSelectTriggerBy.removeWallet,
        removedWalletId: walletId,
      });
    };
    appEventBus.on(EAppEventBusNames.WalletRemove, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.WalletRemove, fn);
    };
  }, [actions, num, sceneName, sceneUrl]);

  // **** autoSelectAccount after AccountRemove
  useEffect(() => {
    const fn = async () => {
      await actions.current.autoSelectNextAccount({
        num,
        sceneName,
        sceneUrl,
        source: 'account-remove',
        triggerBy: EAccountSelectorAutoSelectTriggerBy.removeAccount,
      });
    };
    appEventBus.on(EAppEventBusNames.AccountRemove, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.AccountRemove, fn);
    };
  }, [actions, num, sceneName, sceneUrl]);
}
