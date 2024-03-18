import { type PropsWithChildren, memo } from 'react';

import { ProviderJotaiContextSwap } from '../../../states/jotai/contexts/swap';
import { jotaiContextStore } from '../../../states/jotai/utils/jotaiContextStore';
import { JotaiContextStoreMirrorTracker } from '../../../states/jotai/utils/JotaiContextStoreMirrorTracker';

import { useSwapContextStoreInitData } from './SwapRootProvider';

export const SwapProviderMirror = memo((props: PropsWithChildren) => {
  const { children } = props;

  const data = useSwapContextStoreInitData();
  const store = jotaiContextStore.getOrCreateStore(data);

  return (
    <>
      <JotaiContextStoreMirrorTracker {...data} />
      <ProviderJotaiContextSwap store={store}>
        {children}
      </ProviderJotaiContextSwap>
    </>
  );
});
SwapProviderMirror.displayName = 'DiscoveryBrowserProviderMirror';
