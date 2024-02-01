import { memo, useCallback, useEffect } from 'react';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import {
  useAccountSelectorSceneInfo,
  useAccountSelectorStorageReadyAtom,
  useSelectedAccount,
} from '../../states/jotai/contexts/accountSelector';
import { useAccountSelectorActions } from '../../states/jotai/contexts/accountSelector/actions';

import { useAccountAutoSelect } from './hooks/useAccountAutoSelect';
import { useDeriveTypeAutoSelect } from './hooks/useDeriveTypeAutoSelect';
import { useNetworkAutoSelect } from './hooks/useNetworkAutoSelect';

function AccountSelectorEffectsCmp({ num }: { num: number }) {
  // TODO multiple UI sync
  const actions = useAccountSelectorActions();
  const { selectedAccount, isSelectedAccountDefaultValue } = useSelectedAccount(
    { num },
  );

  const [isReady] = useAccountSelectorStorageReadyAtom();
  const { sceneName, sceneUrl } = useAccountSelectorSceneInfo();

  useAccountAutoSelect({ num });
  useNetworkAutoSelect({ num });
  useDeriveTypeAutoSelect({ num });

  const reloadActiveAccountInfo = useCallback(async () => {
    if (!isReady) {
      return;
    }
    await actions.current.reloadActiveAccountInfo({ num, selectedAccount });
    // do not save initial value to storage
    if (!isSelectedAccountDefaultValue) {
      void actions.current.saveToStorage({
        selectedAccount,
        sceneName,
        sceneUrl,
        num,
      });
    } else {
      console.log(
        'AccountSelector saveToStorage skip:  isSelectedAccountDefaultValue',
      );
    }
  }, [
    actions,
    isReady,
    isSelectedAccountDefaultValue,
    num,
    sceneName,
    sceneUrl,
    selectedAccount,
  ]);

  useEffect(() => {
    void reloadActiveAccountInfo();
  }, [reloadActiveAccountInfo]);

  useEffect(() => {
    const fn = reloadActiveAccountInfo;
    // const fn = () => null;
    appEventBus.on(EAppEventBusNames.AccountUpdate, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.AccountUpdate, fn);
    };
  }, [reloadActiveAccountInfo]);

  return null;
}

export const AccountSelectorEffects = memo(AccountSelectorEffectsCmp);
