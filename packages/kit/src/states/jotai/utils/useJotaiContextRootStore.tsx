import { useEffect, useRef } from 'react';

import type { IJotaiContextStoreData } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { jotaiContextStore } from './jotaiContextStore';

export function useJotaiContextRootStore(data: IJotaiContextStoreData) {
  const store = jotaiContextStore.getOrCreateStore(data);
  const dataRef = useRef(data);
  dataRef.current = data;

  useEffect(() => {
    console.log('JotaiContextRootStore mount', dataRef.current);
    return () => {
      console.log('JotaiContextRootStore unmount', dataRef.current);
      jotaiContextStore.removeStore(dataRef.current);
    };
  }, []);

  return store;
}
