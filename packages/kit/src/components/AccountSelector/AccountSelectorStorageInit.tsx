import { useCallback, useEffect } from 'react';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { okRaceLog } from '@onekeyhq/shared/src/utils/debug/okRaceLog'; // OKRACE

import {
  useAccountSelectorActions,
  useAccountSelectorSceneInfo,
} from '../../states/jotai/contexts/accountSelector';

export function AccountSelectorStorageInit() {
  const actions = useAccountSelectorActions();
  const { sceneName, sceneUrl } = useAccountSelectorSceneInfo();
  if (sceneName === 'swap' || sceneName === 'perp')
    okRaceLog(`StorageInit RENDER scene=${sceneName}`); // OKRACE

  const initFromStorage = useCallback(() => {
    if (sceneName === 'swap' || sceneName === 'perp')
      okRaceLog(`StorageInit-run scene=${sceneName}:${sceneUrl || ''}`); // OKRACE
    return actions.current.initFromStorage({
      sceneName,
      sceneUrl,
    });
  }, [actions, sceneName, sceneUrl]);

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
