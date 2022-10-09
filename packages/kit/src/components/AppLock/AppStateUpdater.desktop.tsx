import { useCallback, useEffect, useRef } from 'react';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useAppSelector } from '../../hooks/redux';

import { AppLockBypass } from './AppLockBypass';

type Status = 'active' | 'background';

const DesktopUpdator = () => {
  const appState = useRef<Status>();
  const onChange = useCallback((nextState: Status) => {
    if (AppLockBypass.Singleton.isOK()) {
      return;
    }
    if (appState.current === 'background' && nextState === 'active') {
      backgroundApiProxy.serviceApp.checkLockStatus();
    }
    appState.current = nextState;
  }, []);
  useEffect(() => window.desktopApi.onAppState(onChange), [onChange]);
  return null;
};

export const AppStateUpdater = () => {
  const enableAppLock = useAppSelector((s) => s.settings.enableAppLock);
  const isPasswordSet = useAppSelector((s) => s.data.isPasswordSet);
  if (!enableAppLock || !isPasswordSet) {
    return null;
  }
  return <DesktopUpdator />;
};
