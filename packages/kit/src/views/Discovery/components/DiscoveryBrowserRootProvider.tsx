import { memo, useEffect, useMemo } from 'react';

import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

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

  useEffect(() => {
    defaultLogger.discovery.browser.browserTabsLifecycle({
      step: 'browserProviderRootMounted',
      source: 'DiscoveryBrowserRootProvider',
      storeName: data.storeName,
    });
  }, [data.storeName]);

  return <ProviderJotaiContextDiscovery store={store} />;
});
DiscoveryBrowserRootProvider.displayName = 'DiscoveryBrowserRootProvider';
