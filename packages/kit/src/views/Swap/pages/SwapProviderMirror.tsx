import { type PropsWithChildren, memo } from 'react';

import type { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { ProviderJotaiContextSwap } from '../../../states/jotai/contexts/swap';
import { jotaiContextStore } from '../../../states/jotai/utils/jotaiContextStore';
import { JotaiContextStoreMirrorTracker } from '../../../states/jotai/utils/JotaiContextStoreMirrorTracker';

import { useSwapContextStoreInitData } from './SwapRootProvider';

export const SwapProviderMirror = memo(
  (props: PropsWithChildren & { storeName: EJotaiContextStoreNames }) => {
    const { children, storeName } = props;

    const data = useSwapContextStoreInitData(storeName);
    const store = jotaiContextStore.getOrCreateStore(data);

    return (
      <>
        <JotaiContextStoreMirrorTracker {...data} />
        <ProviderJotaiContextSwap store={store}>
          {children}
        </ProviderJotaiContextSwap>
      </>
    );
  },
);
SwapProviderMirror.displayName = 'SwapProviderMirror';
