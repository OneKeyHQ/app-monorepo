import type { FC } from 'react';
import { useCallback, useEffect, useRef } from 'react';

import { AppState } from 'react-native';

import type { AppStateStatus } from 'react-native';

type AppStatusActiveListenerProps = { onActive: () => void };

export const AppStatusActiveListener: FC<AppStatusActiveListenerProps> = ({
  onActive,
}) => {
  const appState = useRef(AppState.currentState);
  const onChange = useCallback(
    (nextState: AppStateStatus) => {
      if (appState.current === 'background' && nextState === 'active') {
        onActive?.();
      }
      appState.current = nextState;
    },
    [onActive],
  );
  useEffect(() => {
    const subscription = AppState.addEventListener('change', onChange);
    return () => {
      subscription.remove();
    };
  }, [onChange]);
  return null;
};
