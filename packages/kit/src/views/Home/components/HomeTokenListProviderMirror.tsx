import { type PropsWithChildren, memo } from 'react';

import { ProviderJotaiContextTokenList } from '../../../states/jotai/contexts/tokenList/atoms';
import { jotaiContextStore } from '../../../states/jotai/utils/jotaiContextStore';
import { JotaiContextStoreMirrorTracker } from '../../../states/jotai/utils/JotaiContextStoreMirrorTracker';

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
