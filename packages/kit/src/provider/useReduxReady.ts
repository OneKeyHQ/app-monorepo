import { useEffect, useState } from 'react';

import {
  AppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';

export const useReduxReady = () => {
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    backgroundApiProxy.getState().then((result) => {
      if (result && result.bootstrapped && !isReady) {
        setIsReady(true);
      }
    });
    appEventBus.once(AppEventBusNames.StoreInitedFromPersistor, () => {
      if (!isReady) {
        setIsReady(true);
      }
    });
  }, [isReady]);
  return isReady;
};
