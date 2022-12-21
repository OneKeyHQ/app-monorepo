import { useEffect, useState } from 'react';

import { waitForDataLoaded } from '@onekeyhq/shared/src/background/backgroundUtils';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';
import { useAppSelector } from '../hooks/useAppSelector';
import store from '../store';
import { setIsReduxReady } from '../store/reducers/data';

export function useReduxReady() {
  const isReduxReady = useAppSelector((s) => s.data.isReduxReady);
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    (async () => {
      await waitForDataLoaded({
        logName: 'WaitBackgroundReady @ ThemeApp',
        wait: 300,
        data: async () => {
          const result = await backgroundApiProxy.getState();
          if (result && result.bootstrapped) {
            if (platformEnv.isExtensionUi) {
              store.dispatch({
                // TODO use consts
                type: 'REPLACE_WHOLE_STATE',
                payload: result.state,
                $isDispatchFromBackground: true,
              });
            }
            setTimeout(() => {
              store.dispatch({
                ...setIsReduxReady(),
                $isDispatchFromBackground: true,
              });
            });
            return true;
          }
          return false;
        },
      });
      setIsReady(true);
    })();
  }, []);
  return {
    isReady: isReady && isReduxReady,
  };
}
