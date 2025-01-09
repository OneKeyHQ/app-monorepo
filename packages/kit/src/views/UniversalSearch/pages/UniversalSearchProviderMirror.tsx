import { type PropsWithChildren, memo } from 'react';

import { jotaiContextStore } from '@onekeyhq/kit/src/states/jotai/utils/jotaiContextStore';
import { JotaiContextStoreMirrorTracker } from '@onekeyhq/kit/src/states/jotai/utils/JotaiContextStoreMirrorTracker';
import type { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { ProviderJotaiContextUniversalSearch } from '../../../states/jotai/contexts/universalSearch';

import { useUniversalSearchContextStoreInitData } from './UniversalSearchProvider';

export const UniversalSearchProviderMirror = memo(
  (props: PropsWithChildren & { storeName: EJotaiContextStoreNames }) => {
    const { children, storeName } = props;

    const data = useUniversalSearchContextStoreInitData(storeName);
    const store = jotaiContextStore.getOrCreateStore(data);

    return (
      <>
        <JotaiContextStoreMirrorTracker {...data} />
        <ProviderJotaiContextUniversalSearch store={store}>
          {children}
        </ProviderJotaiContextUniversalSearch>
      </>
    );
  },
);
UniversalSearchProviderMirror.displayName = 'UniversalSearchProviderMirror';
