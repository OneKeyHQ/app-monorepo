import { useCallback, useEffect, useRef } from 'react';

import type { IDesktopAppState } from '@onekeyhq/shared/types/desktop';

export const useHandleAppStateActive = (onHandler: () => void | undefined) => {
  const appState = useRef<IDesktopAppState>();
  const onChange = useCallback(
    (nextState: IDesktopAppState) => {
      if (appState.current === 'background' && nextState === 'active') {
        onHandler?.();
      }
      appState.current = nextState;
    },
    [onHandler],
  );
  useEffect(() => window.desktopApi.onAppState(onChange), [onChange]);
};
