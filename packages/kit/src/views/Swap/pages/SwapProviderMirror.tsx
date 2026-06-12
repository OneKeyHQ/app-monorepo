import { type PropsWithChildren, memo, useRef } from 'react';

import type { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  ESwapTabSwitchType,
  type ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

import {
  ProviderJotaiContextSwap,
  swapFromTokenAmountAtom,
  swapInitialSelectedTokensSyncedAtom,
  swapSelectFromTokenAtom,
  swapSelectToTokenAtom,
  swapSelectedTokensColdStartContextAtom,
  swapTypeSwitchAtom,
} from '../../../states/jotai/contexts/swap';
import { jotaiContextStore } from '../../../states/jotai/utils/jotaiContextStore';
import { JotaiContextStoreMirrorTracker } from '../../../states/jotai/utils/JotaiContextStoreMirrorTracker';

import {
  hydrateSwapAllNetworkDefaultTokensFromGlobalHomeSnapshot,
  useSwapContextStoreInitData,
} from './SwapRootProvider';

export const SwapProviderMirror = memo(
  (
    props: PropsWithChildren & {
      storeName: EJotaiContextStoreNames;
      initialSelectedTokensOnInit?: {
        fromToken?: ISwapToken;
        toToken?: ISwapToken;
        swapType?: ESwapTabSwitchType;
      };
    },
  ) => {
    const { children, initialSelectedTokensOnInit, storeName } = props;

    const data = useSwapContextStoreInitData(storeName);
    const store = jotaiContextStore.getOrCreateStore(data);
    const hasInitializedSelectedTokensRef = useRef(false);
    if (!hasInitializedSelectedTokensRef.current) {
      if (initialSelectedTokensOnInit) {
        hasInitializedSelectedTokensRef.current = true;
        store.set(
          swapSelectFromTokenAtom(),
          initialSelectedTokensOnInit.fromToken,
        );
        store.set(swapSelectToTokenAtom(), initialSelectedTokensOnInit.toToken);
        store.set(swapSelectedTokensColdStartContextAtom(), undefined);
        store.set(swapInitialSelectedTokensSyncedAtom(), true);
        store.set(swapFromTokenAmountAtom(), { value: '', isInput: false });
        store.set(
          swapTypeSwitchAtom(),
          initialSelectedTokensOnInit.swapType ?? ESwapTabSwitchType.SWAP,
        );
      } else {
        hasInitializedSelectedTokensRef.current =
          hydrateSwapAllNetworkDefaultTokensFromGlobalHomeSnapshot(store);
      }
    }

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
