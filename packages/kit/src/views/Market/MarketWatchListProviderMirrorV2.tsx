import { type PropsWithChildren, memo } from 'react';

import { jotaiContextStore } from '@onekeyhq/kit/src/states/jotai/utils/jotaiContextStore';
import { JotaiContextStoreMirrorTracker } from '@onekeyhq/kit/src/states/jotai/utils/JotaiContextStoreMirrorTracker';
import type { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { ProviderJotaiContextMarketV2 } from '../../states/jotai/contexts/marketV2';

import { useMarketWatchListV2ContextStoreInitData } from './MarketWatchListProviderV2';

export const MarketWatchListProviderMirrorV2 = memo(
  (props: PropsWithChildren & { storeName: EJotaiContextStoreNames }) => {
    const { children, storeName } = props;

    const data = useMarketWatchListV2ContextStoreInitData(storeName);
    const store = jotaiContextStore.getOrCreateStore(data);

    return (
      <>
        <JotaiContextStoreMirrorTracker {...data} />
        <ProviderJotaiContextMarketV2 store={store}>
          {children}
        </ProviderJotaiContextMarketV2>
      </>
    );
  },
);
MarketWatchListProviderMirrorV2.displayName = 'MarketWatchListProviderMirrorV2';
