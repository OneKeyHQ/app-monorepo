import { useEffect, useRef } from 'react';

import type { IDesktopAppState } from '@onekeyhq/shared/types/desktop';

import type { IUseHandleAppStateActive } from './types';

export const useHandleAppStateActive: IUseHandleAppStateActive = (
  onHandler,
  handlers,
) => {
  const appState = useRef<IDesktopAppState>();
  useEffect(() => {
    if (!onHandler) return;
    const handleAppStateChange = (nextState: IDesktopAppState) => {
      if (appState.current === 'background' && nextState === 'active') {
        onHandler?.();
      }
      if (
        handlers?.onActiveFromBlur &&
        appState.current === 'blur' &&
        nextState === 'active'
      ) {
        handlers?.onActiveFromBlur?.();
      }
      appState.current = nextState;
    };
    return globalThis.desktopApi.onAppState(handleAppStateChange);
  }, [handlers, onHandler]);
};
