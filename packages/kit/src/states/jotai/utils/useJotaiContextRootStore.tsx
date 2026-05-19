import { useEffect, useRef } from 'react';

import {
  EJotaiContextStoreNames,
  getJotaiContextTrackerMap,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IJotaiContextStoreData } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import {
  buildJotaiContextStoreId,
  jotaiContextStore,
} from './jotaiContextStore';

export function useJotaiContextRootStore(data: IJotaiContextStoreData) {
  const store = jotaiContextStore.getOrCreateStore(data);
  const dataRef = useRef(data);
  dataRef.current = data;

  useEffect(() => {
    // console.log('JotaiContextRootStore mount', dataRef.current);
    return () => {
      // console.log('JotaiContextRootStore unmount', dataRef.current);
      const currentData = dataRef.current;
      if (currentData.storeName === EJotaiContextStoreNames.discoveryBrowser) {
        const storeId = buildJotaiContextStoreId(currentData);
        const mirrorCount = getJotaiContextTrackerMap()[storeId]?.count ?? 0;
        if (mirrorCount > 0) {
          return;
        }
      }
      jotaiContextStore.removeStore(currentData);
    };
  }, []);

  return store;
}
