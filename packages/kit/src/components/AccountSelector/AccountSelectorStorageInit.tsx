import { useCallback, useEffect } from 'react';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import { useAccountSelectorSceneInfo } from '../../states/jotai/contexts/accountSelector';
import { useAccountSelectorActions } from '../../states/jotai/contexts/accountSelector/actions';

export function AccountSelectorStorageInit() {
  const actions = useAccountSelectorActions();
  const { sceneName, sceneUrl } = useAccountSelectorSceneInfo();

  const initFromStorage = useCallback(
    (trigger: 'mount' | 'wallet-clear') =>
      actions.current.initFromStorage({
        sceneName,
        sceneUrl,
        trigger,
      }),
    [actions, sceneName, sceneUrl],
  );

  useEffect(() => {
    void initFromStorage('mount');
  }, [initFromStorage]);

  useEffect(() => {
    const handleWalletClear = () => {
      void initFromStorage('wallet-clear');
    };
    appEventBus.on(EAppEventBusNames.WalletClear, handleWalletClear);
    return () => {
      appEventBus.off(EAppEventBusNames.WalletClear, handleWalletClear);
    };
  }, [initFromStorage]);

  return null;
}
