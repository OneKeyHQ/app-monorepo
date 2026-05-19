import { useEffect, useRef } from 'react';

import { getJotaiContextTrackerMap } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
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
    return () => {
      const currentData = dataRef.current;
      // If any mirror is still mounted for this storeId, the store is still
      // being read from. Removing it now would force the next mirror render
      // to build a brand-new empty store, splitting the store identity and
      // making writes from the old store invisible to readers on the new one.
      const storeId = buildJotaiContextStoreId(currentData);
      const mirrorCount = getJotaiContextTrackerMap()[storeId]?.count ?? 0;
      if (mirrorCount > 0) {
        return;
      }
      jotaiContextStore.removeStore(currentData);
    };
  }, []);

  return store;
}
