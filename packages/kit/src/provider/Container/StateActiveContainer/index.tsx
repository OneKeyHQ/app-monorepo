import { useCallback, useEffect } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useHandleAppStateActive } from '@onekeyhq/kit/src/hooks/useHandleAppStateActive';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

let extSpecialChecked = false;
/**
 * Because the life cycle of browser ext is controlled by background js, so lock check is needed when popup is started.
 * this component should be parent component of AppStateLockContainer.
 * Otherwise, if the user sets lock idle time to 0(always), it will cause the user to fail to unlock app.
 * */
export const StateActiveContainer = () => {
  useEffect(() => {
    void (async () => {
      if (platformEnv.isExtension && !extSpecialChecked) {
        extSpecialChecked = true;
        await backgroundApiProxy.servicePassword.checkLockStatus();
      }
      void backgroundApiProxy.serviceNotification.clearBadgeWhenAppStart();
    })();
  }, []);
  const callback = useCallback(() => {
    void backgroundApiProxy.serviceNotification.clearBadgeWhenAppStart();
  }, []);
  useHandleAppStateActive(callback, {
    onActiveFromBlur: callback,
  });
  return null;
};
