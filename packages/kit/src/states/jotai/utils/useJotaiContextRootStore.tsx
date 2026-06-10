import { useLayoutEffect } from 'react';

import { getJotaiContextTrackerMap } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IJotaiContextStoreData } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { okRaceLog } from '@onekeyhq/shared/src/utils/debug/okRaceLog'; // OKRACE

import {
  buildJotaiContextStoreId,
  jotaiContextStore,
} from './jotaiContextStore';

export function useJotaiContextRootStore(data: IJotaiContextStoreData) {
  const store = jotaiContextStore.getOrCreateStore(data);
  const storeId = buildJotaiContextStoreId(data);

  useLayoutEffect(() => {
    const okTracked = storeId.includes('@swap') || storeId.includes('@perp'); // OKRACE
    if (okTracked)
      okRaceLog(`rootStore MOUNT ${storeId} tag=${(store as any).__okTag}`); // OKRACE
    jotaiContextStore.cancelStoreResetById(storeId, store);
    return () => {
      const mirrorCount = getJotaiContextTrackerMap()[storeId]?.count ?? 0;
      if (okTracked)
        okRaceLog(
          `rootStore UNMOUNT ${storeId} tag=${
            (store as any).__okTag
          } mirrorCount=${mirrorCount} willDelete=${mirrorCount <= 0}`,
        ); // OKRACE
      jotaiContextStore.requestStoreResetById(storeId, store);
      if (mirrorCount <= 0) {
        jotaiContextStore.completeStoreResetIfRequestedById(storeId);
      }
    };
  }, [store, storeId]);

  return store;
}
