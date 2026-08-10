import { useEffect, useRef } from 'react';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
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
  const activeWalletUnavailable = Boolean(
    wallet && accountUtils.isWalletDeprecatedOrMocked(wallet),
  );
  const previousActiveWalletUnavailableRef = useRef(activeWalletUnavailable);

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
    const wasActiveWalletUnavailable =
      previousActiveWalletUnavailableRef.current;
    previousActiveWalletUnavailableRef.current = activeWalletUnavailable;

    if (
      !storageReady ||
      !activeAccountReady ||
      !activeWalletUnavailable ||
      wasActiveWalletUnavailable
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
    activeWalletUnavailable,
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
