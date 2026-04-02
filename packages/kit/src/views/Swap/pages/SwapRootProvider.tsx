import { memo, useMemo } from 'react';

import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { ProviderJotaiContextSwap } from '../../../states/jotai/contexts/swap';
import { useJotaiContextRootStore } from '../../../states/jotai/utils/useJotaiContextRootStore';

export function useSwapContextStoreInitData(
  storeName: EJotaiContextStoreNames,
) {
  const data = useMemo(
    () => ({
      storeName,
    }),
    [storeName],
  );
  return data;
}

export const SwapRootProvider = memo(() => {
  const data = useSwapContextStoreInitData(EJotaiContextStoreNames.swap);
  const store = useJotaiContextRootStore(data);
  return <ProviderJotaiContextSwap store={store} />;
});
SwapRootProvider.displayName = 'SwapRootProvider';

export const SwapModalRootProvider = memo(() => {
  const data = useSwapContextStoreInitData(EJotaiContextStoreNames.swapModal);
  const store = useJotaiContextRootStore(data);
  return <ProviderJotaiContextSwap store={store} />;
});
SwapModalRootProvider.displayName = 'SwapModalRootProvider';
