import { useEffect } from 'react';

import {
  type AppUIEventBusNames,
  appUIEventBus,
} from '@onekeyhq/shared/src/eventBus/appUIEventBus';

function useOnUIEventBus(
  event: AppUIEventBusNames,
  handler: (...args: any[]) => void,
) {
  useEffect(() => {
    appUIEventBus.on(event, handler);
    return () => {
      appUIEventBus.off(event, handler);
    };
  }, [event, handler]);
}

export { useOnUIEventBus };
