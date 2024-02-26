import { memo, useMemo } from 'react';

import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { ProviderJotaiContextTokenList } from '../../../states/jotai/contexts/tokenList/atoms';
import { useJotaiContextRootStore } from '../../../states/jotai/utils/useJotaiContextRootStore';

export function useHomeTokenListContextStoreInitData() {
  const data = useMemo(
    () => ({
      storeName: EJotaiContextStoreNames.homeTokenList,
    }),
    [],
  );
  return data;
}

export const HomeTokenListRootProvider = memo(() => {
  const data = useHomeTokenListContextStoreInitData();
  const store = useJotaiContextRootStore(data);
  return <ProviderJotaiContextTokenList store={store} />;
});
HomeTokenListRootProvider.displayName = 'HomeTokenListRootProvider';
