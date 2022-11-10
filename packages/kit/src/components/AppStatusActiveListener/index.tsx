import platformEnv from '@onekeyhq/shared/src/platformEnv';
import React, { FC, useRef, useCallback, useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';

type Status = 'active' | 'background';

type AppStatusActiveListenerProps = { onActive: (() => void) };

const NativeStatusActiveListener: FC<AppStatusActiveListenerProps> = ({ onActive }) => {
  const appState = useRef(AppState.currentState);
  const onChange = useCallback((nextState: AppStateStatus) => {
    if (appState.current === 'background' && nextState === 'active') {
      onActive?.()
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
        AppState.removeEventListener('change', onChange);
      }
    };
  }, [onChange]);
  return null;
}

const DesktopStatusActiveListener: FC<AppStatusActiveListenerProps> = ({ onActive }) => {
  const appState = useRef<Status>();
  const onChange = useCallback((nextState: Status) => {
    if (appState.current === 'background' && nextState === 'active') {
      onActive?.()
    }
    appState.current = nextState;
  }, []);
  useEffect(() => window.desktopApi.onAppState(onChange), [onChange]);
  return null;
}

export const AppStatusActiveListener: FC<AppStatusActiveListenerProps> = ({ onActive: onActive }) => {
  if (platformEnv.isNative) {
    return <NativeStatusActiveListener onActive={onActive} />
  } else if (platformEnv.isDesktop) {
    return <DesktopStatusActiveListener onActive={onActive} />
  } else {
    return null
  }
}