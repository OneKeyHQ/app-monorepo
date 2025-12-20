import { memo, useMemo } from 'react';

import { useJotaiContextRootStore } from '@onekeyhq/kit/src/states/jotai/utils/useJotaiContextRootStore';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { ProviderJotaiContextMarketV2 } from '../../states/jotai/contexts/marketV2';

export function useMarketWatchListV2ContextStoreInitData(
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

export const MarketWatchListProviderV2 = memo(() => {
  const data = useMarketWatchListV2ContextStoreInitData(
    EJotaiContextStoreNames.marketWatchListV2,
  );
  const store = useJotaiContextRootStore(data);
  return <ProviderJotaiContextMarketV2 store={store} />;
});
MarketWatchListProviderV2.displayName = 'MarketWatchListProviderV2';
