import { memo, useMemo } from 'react';

import { useJotaiContextRootStore } from '@onekeyhq/kit/src/states/jotai/utils/useJotaiContextRootStore';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { ProviderJotaiContextHyperliquid } from '../../states/jotai/contexts/hyperliquid';

export function usePerpsContextStoreInitData(
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

export const PerpsRootProvider = memo(() => {
  const data = usePerpsContextStoreInitData(EJotaiContextStoreNames.perps);
  const store = useJotaiContextRootStore(data);
  return <ProviderJotaiContextHyperliquid store={store} />;
});
PerpsRootProvider.displayName = 'PerpsRootProvider';
