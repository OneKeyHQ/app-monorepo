import { memo, useMemo } from 'react';

import { useJotaiContextRootStore } from '@onekeyhq/kit/src/states/jotai/utils/useJotaiContextRootStore';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { ProviderJotaiContextMarketWatchList } from '../../states/jotai/contexts/market';

export function useMarketWatchListContextStoreInitData(
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

export const MarketWatchListProvider = memo(() => {
  const data = useMarketWatchListContextStoreInitData(
    EJotaiContextStoreNames.marketWatchList,
  );
  const store = useJotaiContextRootStore(data);
  return <ProviderJotaiContextMarketWatchList store={store} />;
});
MarketWatchListProvider.displayName = 'MarketWatchListProvider';
