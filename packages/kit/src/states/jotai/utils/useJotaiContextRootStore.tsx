import { useLayoutEffect } from 'react';

import { getJotaiContextTrackerMap } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IJotaiContextStoreData } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import {
  buildJotaiContextStoreId,
  jotaiContextStore,
} from './jotaiContextStore';

export function useJotaiContextRootStore(data: IJotaiContextStoreData) {
  const store = jotaiContextStore.getOrCreateStore(data);
  const storeId = buildJotaiContextStoreId(data);

  useLayoutEffect(() => {
    // console.log('JotaiContextRootStore mount', storeId);
    jotaiContextStore.cancelStoreResetById(storeId, store);
    return () => {
      // console.log('JotaiContextRootStore unmount', storeId);
      const mirrorCount = getJotaiContextTrackerMap()[storeId]?.count ?? 0;
      jotaiContextStore.requestStoreResetById(storeId, store);
      if (mirrorCount <= 0) {
        jotaiContextStore.completeStoreResetIfRequestedById(storeId);
      }
    };
  }, [store, storeId]);

  return store;
}
