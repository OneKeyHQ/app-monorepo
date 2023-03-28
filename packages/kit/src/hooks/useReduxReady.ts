import { useEffect, useRef, useState } from 'react';

import { waitForDataLoaded } from '@onekeyhq/shared/src/background/backgroundUtils';
import {
  AppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';
import { setIsExtUiReduxReady } from '../store/reducers/data';

import { useAppSelector } from './useAppSelector';

export function useReduxReady() {
  const isExtUiReduxReady = useAppSelector((s) =>
    platformEnv.isExtensionUi ? s.data.isExtUiReduxReady : true,
  );
  // avoid repeat setIsReady
  const isReadyRef = useRef(false);
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
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
              // TODO use consts
              type: 'REPLACE_WHOLE_STATE',
              payload: result.state,
              $isDispatchFromBackground: true,
            });
            setTimeout(() => {
              store.dispatch({
                ...setIsExtUiReduxReady(),
                $isDispatchFromBackground: true,
              });
            });
          } else if (!isReadyRef.current) {
            // other platforms just check if the persistor is ready
            isReadyRef.current = true;
            setIsReady(true);
          }
          return true;
        }
        return false;
      },
    });
    if (!platformEnv.isExtension) {
      appEventBus.once(AppEventBusNames.StoreInitedFromPersistor, () => {
        if (!isReadyRef.current) {
          // other platforms just check if the persistor is ready
          isReadyRef.current = true;
          setIsReady(true);
        }
      });
    }
  }, []);
  return {
    isReady: platformEnv.isExtensionUi ? isExtUiReduxReady : isReady,
  };
}
