import { useCallback, useEffect, useRef } from 'react';

import { AppState } from 'react-native';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useAppSelector } from '../../hooks/redux';

import { AppLockBypass } from './AppLockBypass';

import type { AppStateStatus } from 'react-native';

const NativeUpdator = () => {
  const appState = useRef(AppState.currentState);
  const onChange = useCallback((nextState: AppStateStatus) => {
    if (AppLockBypass.Singleton.isOK()) {
      return;
    }
    if (appState.current === 'background' && nextState === 'active') {
      backgroundApiProxy.serviceApp.checkLockStatus();
    }
    appState.current = nextState;
  }, []);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', onChange);
    return () => {
      // AppState.addEventListener return subscription object in native, but return empty in web
      if (subscription) {
        subscription.remove();
      } else {
        // @ts-ignore
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        AppState.removeEventListener('change', onChange);
      }
    };
  }, [onChange]);
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
