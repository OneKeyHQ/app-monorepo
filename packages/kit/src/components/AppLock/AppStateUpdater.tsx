import { useCallback } from 'react';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useAppSelector } from '../../hooks/redux';
import { useAppStateChange } from '../../hooks/useAppStateChange';
import {
  selectEnableAppLock,
  selectIsPasswordSet,
} from '../../store/selectors';

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
  const enableAppLock = useAppSelector(selectEnableAppLock);
  const isPasswordSet = useAppSelector(selectIsPasswordSet);
  if (!enableAppLock || !isPasswordSet) {
    return null;
  }
  return <NativeUpdator />;
};
