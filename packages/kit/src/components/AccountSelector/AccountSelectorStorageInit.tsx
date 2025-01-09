import { useCallback, useEffect } from 'react';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import {
  useAccountSelectorActions,
  useAccountSelectorSceneInfo,
} from '../../states/jotai/contexts/accountSelector';

export function AccountSelectorStorageInit() {
  const actions = useAccountSelectorActions();
  const { sceneName, sceneUrl } = useAccountSelectorSceneInfo();

  const initFromStorage = useCallback(
    () =>
      actions.current.initFromStorage({
        sceneName,
        sceneUrl,
      }),
    [actions, sceneName, sceneUrl],
  );

  useEffect(() => {
    void initFromStorage();
  }, [initFromStorage]);

  useEffect(() => {
    appEventBus.on(EAppEventBusNames.WalletClear, initFromStorage);
    return () => {
      appEventBus.off(EAppEventBusNames.WalletClear, initFromStorage);
    };
  }, [initFromStorage]);

  return null;
}
