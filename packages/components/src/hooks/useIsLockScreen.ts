import { useEffect, useState } from 'react';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

export function useIsLockScreen() {
  const [isLockScreen, setIsLockScreen] = useState(false);
  useEffect(() => {
    const onLock = () => setIsLockScreen(true);
    const onUnlock = () => setIsLockScreen(false);
    appEventBus.on(EAppEventBusNames.LockApp, onLock);
    appEventBus.on(EAppEventBusNames.UnlockApp, onUnlock);
    return () => {
      appEventBus.off(EAppEventBusNames.LockApp, onLock);
      appEventBus.off(EAppEventBusNames.UnlockApp, onUnlock);
    };
  }, []);
  return isLockScreen;
}
