import { useEffect, useState } from 'react';

import { waitForDataLoaded } from '@onekeyhq/shared/src/background/backgroundUtils';
import {
  AppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';
import { useAppSelector } from '../hooks/useAppSelector';
import { setIsReduxReady } from '../store/reducers/data';

export function useReduxReady() {
  const isReduxReady = useAppSelector((s) => s.data.isReduxReady);
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    if (!isReady) {
      waitForDataLoaded({
        logName: 'WaitBackgroundReady @ ThemeApp',
        wait: 300,
        data: async () => {
          const result = await backgroundApiProxy.getState();
          if (result && result.bootstrapped) {
            if (platformEnv.isExtensionUi) {
              // ext will sync the whole redux state between ext and ui
              const store = (await import('../store')).default;
              store.dispatch({
                // TODO use consts
                type: 'REPLACE_WHOLE_STATE',
                payload: result.state,
                $isDispatchFromBackground: true,
              });
              setTimeout(() => {
                store.dispatch({
                  ...setIsReduxReady(),
                  $isDispatchFromBackground: true,
                });
              });
            } else if (!isReady) {
              // other platforms just check result.bootstrapped
              setIsReady(true);
            }
            return true;
          }
          return false;
        },
      });
    }
    if (!platformEnv.isExtension) {
      appEventBus.once(AppEventBusNames.StoreInitedFromPersistor, () => {
        if (!isReady) {
          // platforms other than ext just check persistor init event
          setIsReady(true);
        }
      });
    }
  }, [isReady]);
  return {
    isReady: platformEnv.isExtension ? isReduxReady : isReady,
  };
}
