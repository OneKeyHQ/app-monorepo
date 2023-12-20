import { useCallback } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useAppStateChange } from '@onekeyhq/kit/src/hooks/useAppStateChange';
import { usePasswordPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { AppStateSignal } from '../AppStateSignal';

const AppStateUpdaterContent = () => {
  const onChange = useCallback(() => {
    if (AppStateSignal.instance.isOff()) {
      return;
    }
    backgroundApiProxy.servicePassword.checkLockStatus().catch(console.error);
  }, []);
  useAppStateChange(onChange);
  return null;
};

export const AppStateUpdater = () => {
  const [settings] = usePasswordPersistAtom();
  if (!settings.isPasswordSet) {
    return null;
  }
  return <AppStateUpdaterContent />;
};
