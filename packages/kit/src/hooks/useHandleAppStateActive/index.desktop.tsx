import { useEffect, useRef } from 'react';

import type { IDesktopAppState } from '@onekeyhq/shared/types/desktop';

export const useHandleAppStateActive = (onHandler: () => void | undefined) => {
  const appState = useRef<IDesktopAppState>();
  useEffect(() => {
    if (!onHandler) return;
    const handleAppStateChange = (nextState: IDesktopAppState) => {
      if (appState.current === 'background' && nextState === 'active') {
        onHandler?.();
      }
      appState.current = nextState;
    };
    return window.desktopApi.onAppState(handleAppStateChange);
  }, [onHandler]);
};
