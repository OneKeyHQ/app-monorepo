import { useEffect, useState } from 'react';

import {
  AppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

export const useReduxReady = () => {
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    appEventBus.once(AppEventBusNames.StoreInitedFromPersistor, () => {
      setIsReady(true);
    });
  }, []);
  return isReady;
};
