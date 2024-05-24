import { type PropsWithChildren, memo } from 'react';

import { jotaiContextStore } from '@onekeyhq/kit/src/states/jotai/utils/jotaiContextStore';
import { JotaiContextStoreMirrorTracker } from '@onekeyhq/kit/src/states/jotai/utils/JotaiContextStoreMirrorTracker';
import type { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import {
  MarketWatchListProvider,
  useMarketWatchListContextStoreInitData,
} from './MarketWatchListProvider';

export const MarketWatchListProviderMirror = memo(
  (props: PropsWithChildren & { storeName: EJotaiContextStoreNames }) => {
    const { children, storeName } = props;

    const data = useMarketWatchListContextStoreInitData(storeName);
    const store = jotaiContextStore.getOrCreateStore(data);

    return (
      <>
        <JotaiContextStoreMirrorTracker {...data} />
        <MarketWatchListProvider store={store}>
          {children}
        </MarketWatchListProvider>
      </>
    );
  },
);
MarketWatchListProviderMirror.displayName = 'MarketWatchListProviderMirror';
