import { useEffect, useRef } from 'react';

import { AppState } from 'react-native';

import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { AppStateStatus } from 'react-native';

const listenerEvent = 'change';

export const isFromBackgroundToForeground = (
  currentState: AppStateStatus,
  nextAppState: AppStateStatus,
) => {
  if (platformEnv.isNative) {
    return !!(
      /inactive|background/.exec(currentState) && nextAppState === 'active'
    );
  }

  return false;
};

export const useAppStateChange = (
  onHandler: (state: AppStateStatus) => void | undefined,
  options?: {
    unFilter?: boolean;
  },
) => {
  const appState = useRef(AppState.currentState);
  useEffect(() => {
    const listener = AppState.addEventListener(listenerEvent, (nextState) => {
      debugLogger.common.debug(
        `AppState changed callback trigger from: ${appState.current} , to: ${nextState}`,
      );
      if (
        options?.unFilter ||
        isFromBackgroundToForeground(appState.current, nextState)
      ) {
        onHandler?.(nextState);
      }
      appState.current = nextState;
    });

    return () => {
      listener?.remove?.();
    };
  }, [options?.unFilter, onHandler]);
};
