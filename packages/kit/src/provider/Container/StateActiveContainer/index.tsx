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
        await Promise.all([
          backgroundApiProxy.servicePassword.checkLockStatus(),
          backgroundApiProxy.serviceSetting.fetchInscriptionProtectionControl({
            forceRefresh: true,
          }),
        ]);
      }
      void backgroundApiProxy.serviceNotification.clearBadgeWhenAppStart();
    })();
  }, []);
  const callback = useCallback(() => {
    void backgroundApiProxy.serviceNotification.clearBadgeWhenAppStart();
    void backgroundApiProxy.serviceSetting.fetchInscriptionProtectionControl();
  }, []);
  useHandleAppStateActive(callback, {
    onActiveFromBlur: callback,
  });
  return null;
};
