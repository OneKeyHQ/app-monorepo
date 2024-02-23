import { useEffect } from 'react';

import type { IJotaiContextStoreData } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { jotaiContextStore } from './jotaiContextStore';

export function useJotaiContextRootStore(data: IJotaiContextStoreData) {
  const store = jotaiContextStore.getOrCreateStore(data);
  useEffect(() => {
    console.log('JotaiContextRootStore mount', data);
    return () => {
      console.log('JotaiContextRootStore unmount', data);
      jotaiContextStore.removeStore(data);
    };
  }, [data]);
  return store;
}
