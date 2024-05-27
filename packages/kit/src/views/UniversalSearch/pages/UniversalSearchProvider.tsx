import { memo, useMemo } from 'react';

import { useJotaiContextRootStore } from '@onekeyhq/kit/src/states/jotai/utils/useJotaiContextRootStore';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { ProviderJotaiContextUniversalSearch } from '../../../states/jotai/contexts/universalSearch';

export function useUniversalSearchContextStoreInitData(
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

export const UniversalSearchProvider = memo(() => {
  const data = useUniversalSearchContextStoreInitData(
    EJotaiContextStoreNames.universalSearch,
  );
  const store = useJotaiContextRootStore(data);
  return <ProviderJotaiContextUniversalSearch store={store} />;
});
UniversalSearchProvider.displayName = 'UniversalSearchProvider';
