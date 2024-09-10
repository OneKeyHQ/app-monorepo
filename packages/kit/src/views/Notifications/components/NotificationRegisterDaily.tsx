import { useEffect } from 'react';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useRouteIsFocused } from '../../../hooks/useRouteIsFocused';

export function NotificationRegisterDaily() {
  const isFocused = useRouteIsFocused();
  useEffect(() => {
    if (isFocused) {
      void backgroundApiProxy.serviceNotification.registerClientDaily();
    }
  }, [isFocused]);
  return <></>;
}
