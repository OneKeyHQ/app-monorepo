import { memo, useMemo } from 'react';

import { ProviderJotaiContextTokenList } from '@onekeyhq/kit/src/states/jotai/contexts/tokenList/atoms';
import { useJotaiContextRootStore } from '@onekeyhq/kit/src/states/jotai/utils/useJotaiContextRootStore';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

export function useUrlAccountHomeTokenListContextStoreInitData() {
  const data = useMemo(
    () => ({
      storeName: EJotaiContextStoreNames.urlAccountHomeTokenList,
    }),
    [],
  );
  return data;
}

export const UrlAccountHomeTokenListProvider = memo(() => {
  const data = useUrlAccountHomeTokenListContextStoreInitData();
  const store = useJotaiContextRootStore(data);
  return <ProviderJotaiContextTokenList store={store} />;
});
UrlAccountHomeTokenListProvider.displayName = 'UrlAccountHomeTokenListProvider';
