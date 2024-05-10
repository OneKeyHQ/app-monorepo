import { type PropsWithChildren, memo } from 'react';

import { ProviderJotaiContextTokenList } from '@onekeyhq/kit/src/states/jotai/contexts/tokenList/atoms';
import { jotaiContextStore } from '@onekeyhq/kit/src/states/jotai/utils/jotaiContextStore';
import { JotaiContextStoreMirrorTracker } from '@onekeyhq/kit/src/states/jotai/utils/JotaiContextStoreMirrorTracker';

import { useHomeTokenListContextStoreInitData } from './HomeTokenListRootProvider';

export const HomeTokenListProviderMirror = memo((props: PropsWithChildren) => {
  const { children } = props;

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
});
HomeTokenListProviderMirror.displayName = 'HomeTokenListProviderMirror';
