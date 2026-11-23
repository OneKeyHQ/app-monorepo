import { useCallback, useEffect } from 'react';

import { useHandleAppStateActive } from '@onekeyhq/kit/src/hooks/useHandleAppStateActive';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

export const StateActiveContainer = () => {
  const resumeLiveActivities = useCallback(() => {
    if (platformEnv.isDev) {
      void backgroundApiProxy.serviceLiveActivity
        .resumeRemoteSubscriptions()
        .catch(() => undefined);
    }
  }, []);
  const callback = useCallback(() => {
    void backgroundApiProxy.serviceNotification.clearBadgeWhenAppStart();
    void backgroundApiProxy.serviceSetting.fetchInscriptionProtectionControl();
    resumeLiveActivities();
  }, [resumeLiveActivities]);
  useEffect(resumeLiveActivities, [resumeLiveActivities]);
  useHandleAppStateActive(callback, {
    onActiveFromBlur: callback,
  });
  return null;
};
