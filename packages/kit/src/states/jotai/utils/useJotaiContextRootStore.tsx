import { useEffect, useRef } from 'react';

import {
  EJotaiContextStoreNames,
  getJotaiContextTrackerMap,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IJotaiContextStoreData } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import {
  buildJotaiContextStoreId,
  getJotaiContextStoreDebugId,
  jotaiContextStore,
} from './jotaiContextStore';

export function useJotaiContextRootStore(data: IJotaiContextStoreData) {
  const store = jotaiContextStore.getOrCreateStore(data);
  const dataRef = useRef(data);
  const storeRef = useRef(store);
  dataRef.current = data;
  storeRef.current = store;

  useEffect(() => {
    // console.log('JotaiContextRootStore mount', dataRef.current);
    return () => {
      // console.log('JotaiContextRootStore unmount', dataRef.current);
      const currentData = dataRef.current;
      if (currentData.storeName === EJotaiContextStoreNames.discoveryBrowser) {
        const logicalStoreId = buildJotaiContextStoreId(currentData);
        const mirrorCount =
          getJotaiContextTrackerMap()[logicalStoreId]?.count ?? 0;
        if (mirrorCount > 0) {
          defaultLogger.discovery.browser.browserTabsLifecycle({
            step: 'jotaiContextRootStoreRemoveSkipped',
            source: 'useJotaiContextRootStore',
            storeName: currentData.storeName,
            logicalStoreId,
            storeIdentity: getJotaiContextStoreDebugId(storeRef.current),
            mirrorCount,
            result: 'skipped',
            reason: 'active_mirror_count',
          });
          return;
        }
      }
      jotaiContextStore.removeStore(currentData);
    };
  }, []);

  return store;
}
