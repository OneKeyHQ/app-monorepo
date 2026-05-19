import { type PropsWithChildren, memo } from 'react';

import { ProviderJotaiContextDiscovery } from '../../../states/jotai/contexts/discovery/atoms';
import { jotaiContextStore } from '../../../states/jotai/utils/jotaiContextStore';
import { JotaiContextStoreMirrorTracker } from '../../../states/jotai/utils/JotaiContextStoreMirrorTracker';

import { useDiscoveryBrowserContextStoreInitData } from './DiscoveryBrowserRootProvider';

export const DiscoveryBrowserProviderMirror = memo(
  (props: PropsWithChildren) => {
    const { children } = props;

    const data = useDiscoveryBrowserContextStoreInitData();
    const store = jotaiContextStore.getOrCreateStore(data);

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
