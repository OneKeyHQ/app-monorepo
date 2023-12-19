import { useEffect, useRef } from 'react';

import { AppState } from 'react-native';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { AppStateStatus } from 'react-native';

export const isFromBackgroundToForeground = (
  currentState: AppStateStatus,
  nextAppState: AppStateStatus,
) => {
  if (platformEnv.isNativeAndroid) {
    return !!(
      /inactive|background/.exec(currentState) && nextAppState === 'active'
    );
  }

  return currentState === 'background' && nextAppState === 'active';
};

export const useAppStateChange = (
  onHandler: (state: AppStateStatus) => void | undefined,
  options?: {
    unFilter?: boolean;
  },
) => {
  const appState = useRef<AppStateStatus>(AppState.currentState);
  useEffect(() => {
    const onCall = (nextState: AppStateStatus) => {
      if (
        options?.unFilter ||
        isFromBackgroundToForeground(appState.current, nextState)
      ) {
        onHandler?.(nextState);
      }
      appState.current = nextState;
    };
    const listener = AppState.addEventListener('change', onCall);
    return () => {
      listener?.remove?.();
    };
  }, [options?.unFilter, onHandler]);
};
