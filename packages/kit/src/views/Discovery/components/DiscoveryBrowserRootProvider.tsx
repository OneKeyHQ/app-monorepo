import { memo, useMemo } from 'react';

import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { ProviderJotaiContextDiscovery } from '../../../states/jotai/contexts/discovery/atoms';
import { useJotaiContextRootStore } from '../../../states/jotai/utils/useJotaiContextRootStore';

export function useDiscoveryBrowserContextStoreInitData() {
  const data = useMemo(
    () => ({
      storeName: EJotaiContextStoreNames.discoveryBrowser,
    }),
    [],
  );
  return data;
}

export const DiscoveryBrowserRootProvider = memo(() => {
  const data = useDiscoveryBrowserContextStoreInitData();
  const store = useJotaiContextRootStore(data);
  return <ProviderJotaiContextDiscovery store={store} />;
});
DiscoveryBrowserRootProvider.displayName = 'DiscoveryBrowserRootProvider';
