import { useCallback } from 'react';

import { useHandleAppStateActive } from '@onekeyhq/kit/src/hooks/useHandleAppStateActive';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

export const StateActiveContainer = () => {
  const callback = useCallback(() => {
    void backgroundApiProxy.serviceNotification.clearBadgeWhenAppStart();
    void backgroundApiProxy.serviceSetting.fetchInscriptionProtectionControl();
  }, []);
  useHandleAppStateActive(callback, {
    onActiveFromBlur: callback,
  });
  return null;
};
