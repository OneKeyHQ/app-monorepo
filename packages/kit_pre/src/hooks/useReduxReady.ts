import { useCallback, useEffect, useState } from 'react';

import {
  REPLACE_WHOLE_STATE,
  waitForDataLoaded,
} from '@onekeyhq/shared/src/background/backgroundUtils';
import {
  AppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';

export function isReduxReady() {
  return global.$appIsReduxReady;
}

export function useReduxReady() {
  const [isReady, setIsReady] = useState(global.$appIsReduxReady);

  const setIsReadyTrue = useCallback(() => {
    if (!global.$appIsReduxReady || !isReady) {
      global.$appIsReduxReady = true;
      setIsReady(true);
    }
  }, [isReady]);

  useEffect(() => {
    if (isReady) {
      return;
    }
    if (!platformEnv.isExtension) {
      appEventBus.once(
        AppEventBusNames.StoreInitedFromPersistor,
        setIsReadyTrue,
      );
    }
    waitForDataLoaded({
      logName: 'WaitBackgroundReady @ ThemeApp',
      wait: 300,
      data: async () => {
        const result = await backgroundApiProxy.getState();
        if (result && result.bootstrapped) {
          if (platformEnv.isExtensionUi) {
            const store = (await import('../store')).default;
            // ext will sync the whole redux state between ext and ui
            store.dispatch({
              type: REPLACE_WHOLE_STATE,
              payload: result.state,
              $isDispatchFromBackground: true,
            });
          }
          setTimeout(setIsReadyTrue, 0);
          return true;
        }
        return false;
      },
    });
  }, [isReady, setIsReadyTrue]);

  return {
    isReady,
  };
}
