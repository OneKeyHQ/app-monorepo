import { useCallback, useEffect } from 'react';

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

export function AccountSelectorEffects({
  num,
  children,
}: {
  num: number;
  children?: any;
}) {
  // TODO multiple UI sync
  const actions = useAccountSelectorActions();
  const { selectedAccount, isSelectedAccountDefaultValue } = useSelectedAccount(
    { num },
  );
  const [isReady] = useAccountSelectorStorageReadyAtom();
  const { sceneName } = useAccountSelectorSceneInfo();

  useEffect(() => {
    void actions.current.initFromStorage({
      sceneName,
      num,
    });
  }, [actions, num, sceneName]);

  const reloadActiveAccountInfo = useCallback(() => {
    void actions.current.reloadActiveAccountInfo({ num, selectedAccount });
    // do not save initial value to storage
    if (!isSelectedAccountDefaultValue) {
      void actions.current.saveToStorage({
        selectedAccount,
        sceneName,
        num,
      });
    } else {
      console.log(
        'AccountSelector saveToStorage skip:  isSelectedAccountDefaultValue',
      );
    }
  }, [actions, isSelectedAccountDefaultValue, num, sceneName, selectedAccount]);

  useEffect(() => {
    reloadActiveAccountInfo();
  }, [reloadActiveAccountInfo]);

  useEffect(() => {
    const fn = reloadActiveAccountInfo;
    // const fn = () => null;
    appEventBus.on(EAppEventBusNames.AccountUpdate, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.AccountUpdate, fn);
    };
  }, [reloadActiveAccountInfo]);

  if (isReady) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return children;
  }
  return null;
}
