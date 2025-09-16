import { type PropsWithChildren, memo } from 'react';

import { jotaiContextStore } from '@onekeyhq/kit/src/states/jotai/utils/jotaiContextStore';
import { JotaiContextStoreMirrorTracker } from '@onekeyhq/kit/src/states/jotai/utils/JotaiContextStoreMirrorTracker';
import type { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { ProviderJotaiContextHyperliquid } from '../../states/jotai/contexts/hyperliquid';

import { usePerpsContextStoreInitData } from './PerpsProvider';

export const PerpsProviderMirror = memo(
  (props: PropsWithChildren & { storeName: EJotaiContextStoreNames }) => {
    const { children, storeName } = props;

    const data = usePerpsContextStoreInitData(storeName);
    const store = jotaiContextStore.getOrCreateStore(data);

    return (
      <>
        <JotaiContextStoreMirrorTracker {...data} />
        <ProviderJotaiContextHyperliquid store={store}>
          {children}
        </ProviderJotaiContextHyperliquid>
      </>
    );
  },
);
PerpsProviderMirror.displayName = 'PerpsProviderMirror';
