import { useCallback, useEffect, useRef } from 'react';

import type { IDesktopAppState } from '@onekeyhq/desktop/src-electron/preload';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useAppSelector } from '../../hooks/redux';
import {
  selectEnableAppLock,
  selectIsPasswordSet,
} from '../../store/selectors';

import { AppLockBypass } from './AppLockBypass';

type Status = IDesktopAppState;

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
  const enableAppLock = useAppSelector(selectEnableAppLock);
  const isPasswordSet = useAppSelector(selectIsPasswordSet);
  if (!enableAppLock || !isPasswordSet) {
    return null;
  }
  return <DesktopUpdator />;
};
