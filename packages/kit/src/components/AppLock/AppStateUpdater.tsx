import { useCallback } from 'react';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useAppSelector } from '../../hooks/redux';
import { useAppStateChange } from '../../hooks/useAppStateChange';

import { AppLockBypass } from './AppLockBypass';

const NativeUpdator = () => {
  const onChange = useCallback(() => {
    if (AppLockBypass.Singleton.isOK()) {
      return;
    }
    backgroundApiProxy.serviceApp.checkLockStatus();
  }, []);
  useAppStateChange(onChange);
  return null;
};

export const AppStateUpdater = () => {
  const enableAppLock = useAppSelector((s) => s.settings.enableAppLock);
  const isPasswordSet = useAppSelector((s) => s.data.isPasswordSet);
  if (!enableAppLock || !isPasswordSet) {
    return null;
  }
  return <NativeUpdator />;
};
