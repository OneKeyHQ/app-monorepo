import { useEffect, useRef } from 'react';

import { AppState, type AppStateStatus } from 'react-native';

import type { IUseHandleAppStateActive } from './types';

export const isFromBackgroundToForeground = (
  currentState: AppStateStatus,
  nextAppState: AppStateStatus,
) => currentState === 'background' && nextAppState === 'active';

export const useHandleAppStateActive: IUseHandleAppStateActive = (
  onHandler,
  handlers,
) => {
  const appState = useRef<AppStateStatus>(AppState.currentState);
  useEffect(() => {
    if (!onHandler) return;
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (isFromBackgroundToForeground(appState.current, nextState)) {
        onHandler?.();
      }
      if (
        handlers?.onActiveFromBlur &&
        appState.current === 'inactive' &&
        nextState === 'active'
      ) {
        handlers?.onActiveFromBlur?.();
      }
      appState.current = nextState;
    };
    const subscription = AppState.addEventListener(
      'change',
      handleAppStateChange,
    );
    return () => {
      subscription?.remove?.();
    };
  }, [handlers, onHandler]);
};
