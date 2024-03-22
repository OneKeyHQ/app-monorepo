import { useCallback, useEffect } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useHandleAppStateActive } from '@onekeyhq/kit/src/hooks/useHandleAppStateActive';
import { usePasswordPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { AppStateSignal } from '../AppStateSignal';

let extSpecialChecked = false;
/**
 * Because the life cycle of browser ext is controlled by background js, so lock check is needed when popup is started.
 * */
const AppStateUpdaterContentExtOnly = () => {
  useEffect(() => {
    if (platformEnv.isExtension && !extSpecialChecked) {
      extSpecialChecked = true;
      void backgroundApiProxy.servicePassword.checkLockStatus();
    }
  }, []);
  return null;
};

const AppStateUpdaterContent = () => {
  const handler = useCallback(() => {
    if (AppStateSignal.instance.isOff()) {
      return;
    }
    void backgroundApiProxy.servicePassword.checkLockStatus();
  }, []);
  useHandleAppStateActive(handler);
  return null;
};

export const AppStateUpdater = () => {
  const [settings] = usePasswordPersistAtom();
  if (!settings.isPasswordSet) {
    return null;
  }
  return (
    <>
      <AppStateUpdaterContent />
      <AppStateUpdaterContentExtOnly />
    </>
  );
};
