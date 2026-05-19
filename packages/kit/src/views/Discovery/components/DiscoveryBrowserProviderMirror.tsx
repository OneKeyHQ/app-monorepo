import { type PropsWithChildren, memo, useEffect, useMemo } from 'react';

import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import { ProviderJotaiContextDiscovery } from '../../../states/jotai/contexts/discovery/atoms';
import {
  buildJotaiContextStoreId,
  getJotaiContextStoreDebugId,
  jotaiContextStore,
} from '../../../states/jotai/utils/jotaiContextStore';
import { JotaiContextStoreMirrorTracker } from '../../../states/jotai/utils/JotaiContextStoreMirrorTracker';

import { useDiscoveryBrowserContextStoreInitData } from './DiscoveryBrowserRootProvider';

export const DiscoveryBrowserProviderMirror = memo(
  (props: PropsWithChildren) => {
    const { children } = props;

    const data = useDiscoveryBrowserContextStoreInitData();
    const store = jotaiContextStore.getOrCreateStore(data);
    const logicalStoreId = useMemo(
      () => buildJotaiContextStoreId(data),
      [data],
    );
    const storeIdentity = useMemo(
      () => getJotaiContextStoreDebugId(store),
      [store],
    );

    useEffect(() => {
      defaultLogger.discovery.browser.browserTabsLifecycle({
        step: 'browserProviderMirrorMounted',
        source: 'DiscoveryBrowserProviderMirror',
        storeName: data.storeName,
        logicalStoreId,
        storeIdentity,
      });
    }, [data.storeName, logicalStoreId, storeIdentity]);

    return (
      <>
        <JotaiContextStoreMirrorTracker {...data} />
        <ProviderJotaiContextDiscovery store={store}>
          {children}
        </ProviderJotaiContextDiscovery>
      </>
    );
  },
);
DiscoveryBrowserProviderMirror.displayName = 'DiscoveryBrowserProviderMirror';
