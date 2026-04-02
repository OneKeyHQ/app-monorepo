import { type PropsWithChildren, memo } from 'react';

import { jotaiContextStore } from '@onekeyhq/kit/src/states/jotai/utils/jotaiContextStore';
import { JotaiContextStoreMirrorTracker } from '@onekeyhq/kit/src/states/jotai/utils/JotaiContextStoreMirrorTracker';

import { ProviderJotaiContextHyperliquid } from '../../states/jotai/contexts/hyperliquid';

import { usePerpsContextStoreInitData } from './PerpsProvider';

export const PerpsProviderMirror = memo((props: PropsWithChildren) => {
  const { children } = props;

  const data = usePerpsContextStoreInitData();
  const store = jotaiContextStore.getOrCreateStore(data);

  return (
    <>
      <JotaiContextStoreMirrorTracker {...data} />
      <ProviderJotaiContextHyperliquid store={store}>
        {children}
      </ProviderJotaiContextHyperliquid>
    </>
  );
});
PerpsProviderMirror.displayName = 'PerpsProviderMirror';
