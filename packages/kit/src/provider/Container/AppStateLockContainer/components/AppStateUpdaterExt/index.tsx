import { useEffect } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { AppStateSignal } from '../AppStateSignal';

let extSpecialChecked = false;
/**
 * Because the life cycle of browser ext is controlled by background js, so lock check is needed when popup is started.
 * this component should be parent component of AppStateLockContainer.
 * Otherwise, if the user sets lock idle time to 0(always), it will cause the user to fail to unlock app.
 * */
export const AppStateUpdaterExt = () => {
  useEffect(() => {
    if (platformEnv.isExtension && !extSpecialChecked) {
      extSpecialChecked = true;
      void backgroundApiProxy.servicePassword.checkLockStatus();
    }
  }, []);
  return null;
};
