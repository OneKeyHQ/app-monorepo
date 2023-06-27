import { useEffect, useRef } from 'react';

import { AppState, Platform } from 'react-native';

import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import type { AppStateStatus } from 'react-native';

const focusEvent = Platform.OS === 'android' ? 'focus' : 'change';

export const isFromBackgroundToForeground = (
  currentState: AppStateStatus,
  nextAppState: AppStateStatus,
) => {
  if (Platform.OS === 'ios') {
    return !!(
      /inactive|background/.exec(currentState) && nextAppState === 'active'
    );
  }
  if (Platform.OS === 'android') {
    return true;
  }

  return false;
};

export const useAppStateChange = (
  handler: (state: AppStateStatus) => void | undefined,
) => {
  const appState = useRef(AppState.currentState);
  useEffect(() => {
    const listener = AppState.addEventListener(focusEvent, (nextState) => {
      debugLogger.common.debug(
        `AppState changed callback trigger from: ${appState.current} , to: ${nextState}`,
      );
      if (isFromBackgroundToForeground(appState.current, nextState)) {
        handler?.(nextState);
      }
    });

    return () => {
      listener?.remove?.();
    };
  }, [handler]);
};
