import { useEffect, useRef } from 'react';

import { AppState, type AppStateStatus } from 'react-native';

export const isFromBackgroundToForeground = (
  currentState: AppStateStatus,
  nextAppState: AppStateStatus,
) => currentState === 'background' && nextAppState === 'active';

export const useHandleAppStateActive = (onHandler: () => void | undefined) => {
  const appState = useRef<AppStateStatus>(AppState.currentState);
  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (isFromBackgroundToForeground(appState.current, nextState)) {
        onHandler?.();
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
  }, [onHandler]);
};
