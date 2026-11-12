import { type PropsWithChildren, memo } from 'react';

import { ProviderJotaiContextTokenList } from '@onekeyhq/kit/src/states/jotai/contexts/tokenList/atoms';
import { jotaiContextStore } from '@onekeyhq/kit/src/states/jotai/utils/jotaiContextStore';
import { JotaiContextStoreMirrorTracker } from '@onekeyhq/kit/src/states/jotai/utils/JotaiContextStoreMirrorTracker';

import { useHomeTokenListContextStoreInitData } from './HomeTokenListRootProvider';

// Headers share the Home store but do not need to prime token cells at startup.
export const HomeTokenListHeaderProviderMirror = memo(
  ({ children }: PropsWithChildren) => {
    const data = useHomeTokenListContextStoreInitData();
    const store = jotaiContextStore.getOrCreateStore(data);

    return (
      <>
        <JotaiContextStoreMirrorTracker {...data} />
        <ProviderJotaiContextTokenList store={store}>
          {children}
        </ProviderJotaiContextTokenList>
      </>
    );
  },
);
HomeTokenListHeaderProviderMirror.displayName =
  'HomeTokenListHeaderProviderMirror';
