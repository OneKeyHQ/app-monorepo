import { useCallback, useEffect, useRef } from 'react';

import type { IDesktopAppState } from '@onekeyhq/desktop/src-electron/preload';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePasswordPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { AppStateSignal } from '../AppStateSignal';

const AppStateUpdaterContent = () => {
  const appState = useRef<IDesktopAppState>();
  const onChange = useCallback((nextState: IDesktopAppState) => {
    if (appState.current === 'background' && nextState === 'active') {
      if (AppStateSignal.instance.isOff()) {
        return;
      }
      backgroundApiProxy.servicePassword.checkLockStatus().catch(console.error);
    }
    appState.current = nextState;
  }, []);
  useEffect(() => window.desktopApi.onAppState(onChange), [onChange]);
  return null;
};

export const AppStateUpdater = () => {
  const [settings] = usePasswordPersistAtom();
  if (!settings.isPasswordSet) {
    return null;
  }
  return <AppStateUpdaterContent />;
};
