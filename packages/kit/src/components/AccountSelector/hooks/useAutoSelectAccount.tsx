import { useEffect, useRef } from 'react';

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
    activeAccount: { ready: activeAccountReady, account, wallet },
  } = useActiveAccount({ num });
  const [storageReady] = useAccountSelectorStorageReadyAtom();
  const { sceneName, sceneUrl } = useAccountSelectorSceneInfo();

  const actions = useAccountSelectorActions();
  const activeWalletMocked = Boolean(wallet?.isMocked);
  const previousActiveWalletMockedRef = useRef(activeWalletMocked);

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
      });
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [actions, activeAccountReady, num, sceneName, sceneUrl, storageReady]);

  useEffect(() => {
    const wasActiveWalletMocked = previousActiveWalletMockedRef.current;
    previousActiveWalletMockedRef.current = activeWalletMocked;

    if (
      !storageReady ||
      !activeAccountReady ||
      !activeWalletMocked ||
      wasActiveWalletMocked
    ) {
      return;
    }

    void actions.current.autoSelectNextAccount({
      num,
      sceneName,
      sceneUrl,
    });
  }, [
    actions,
    activeAccountReady,
    activeWalletMocked,
    num,
    sceneName,
    sceneUrl,
    storageReady,
  ]);

  // **** autoSelectAccount after WalletUpdate
  useEffect(() => {
    const fn = async () => {
      if (!account) {
        await timerUtils.wait(600);
        await actions.current.autoSelectNextAccount({
          num,
          sceneName,
          sceneUrl,
        });
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
      await actions.current.autoSelectNextAccount({
        num,
        sceneName,
        sceneUrl,
        triggerBy: EAccountSelectorAutoSelectTriggerBy.removeAccount,
      });
    };
    appEventBus.on(EAppEventBusNames.AccountRemove, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.AccountRemove, fn);
    };
  }, [actions, num, sceneName, sceneUrl]);
}
