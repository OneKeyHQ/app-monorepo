import { type PropsWithChildren, memo, useRef } from 'react';

import type { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { isSwapSelectedTokensColdStartContextMatched } from '@onekeyhq/shared/src/utils/swapColdStartCacheSnapshotUtils';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import {
  ESwapTabSwitchType,
  type ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

import {
  ProviderJotaiContextSwap,
  swapBalanceDisplayCacheAtom,
  swapFromTokenAmountAtom,
  swapInitialSelectedTokensSyncedAtom,
  swapSelectFromTokenAtom,
  swapSelectToTokenAtom,
  swapSelectedTokensColdStartContextAtom,
  swapStockSelectedTokenAtom,
  swapTypeSwitchAtom,
  useSwapStockSelectedTokenAtom,
} from '../../../states/jotai/contexts/swap';
import { jotaiContextStore } from '../../../states/jotai/utils/jotaiContextStore';
import { JotaiContextStoreMirrorTracker } from '../../../states/jotai/utils/JotaiContextStoreMirrorTracker';
import { updateSwapBalanceDisplayCache } from '../utils/swapBalanceDisplayCacheUtils';
import { getVisibleSwapTabSwitchType } from '../utils/swapTypeUtils';

import {
  hydrateSwapDefaultTokensFromGlobalHomeSnapshot,
  useSwapContextStoreInitData,
} from './SwapRootProvider';

function SwapProviderMirrorColdStartCacheSync() {
  useSwapStockSelectedTokenAtom();
  return null;
}

export const SwapProviderMirror = memo(
  (
    props: PropsWithChildren & {
      storeName: EJotaiContextStoreNames;
      initialSelectedTokensOnInit?: {
        accountKey?: string;
        fromToken?: ISwapToken;
        toToken?: ISwapToken;
        swapType?: ESwapTabSwitchType;
      };
    },
  ) => {
    const { children, initialSelectedTokensOnInit, storeName } = props;

    const data = useSwapContextStoreInitData(storeName);
    const store = jotaiContextStore.prepareStoreForImmediateUse(data);
    const hasInitializedSelectedTokensRef = useRef(false);
    if (!hasInitializedSelectedTokensRef.current) {
      if (initialSelectedTokensOnInit) {
        const initialSwapType =
          getVisibleSwapTabSwitchType(initialSelectedTokensOnInit.swapType) ??
          ESwapTabSwitchType.SWAP;
        const entryContext =
          initialSelectedTokensOnInit.accountKey &&
          initialSelectedTokensOnInit.fromToken?.networkId
            ? {
                accountKey: initialSelectedTokensOnInit.accountKey,
                networkId: initialSelectedTokensOnInit.fromToken.networkId,
                swapType: initialSwapType,
                updatedAt: Date.now(),
              }
            : undefined;
        const cachedContext = store.get(
          swapSelectedTokensColdStartContextAtom(),
        );
        const canReuseCachedTokens =
          isSwapSelectedTokensColdStartContextMatched({
            cachedContext,
            currentContext: entryContext,
          });
        const cachedFromToken = store.get(swapSelectFromTokenAtom());
        const cachedToToken = store.get(swapSelectToTokenAtom());
        const isReusableToToken = (token?: ISwapToken) =>
          Boolean(
            canReuseCachedTokens &&
            token &&
            token.networkId ===
              initialSelectedTokensOnInit.fromToken?.networkId &&
            !equalTokenNoCaseSensitive({
              token1: token,
              token2: initialSelectedTokensOnInit.fromToken,
            }),
          );
        let initialToToken = initialSelectedTokensOnInit.toToken;
        if (!initialToToken && isReusableToToken(cachedToToken)) {
          initialToToken = cachedToToken;
        } else if (!initialToToken && isReusableToToken(cachedFromToken)) {
          initialToToken = cachedFromToken;
        }
        const initialBalanceDisplayCache = store.get(
          swapBalanceDisplayCacheAtom(),
        );
        const seededBalanceDisplayCache = [
          initialSelectedTokensOnInit.fromToken,
          initialToToken,
        ].reduce(
          (cache, token) =>
            updateSwapBalanceDisplayCache({
              accountAddress: token?.accountAddress,
              accountKey: initialSelectedTokensOnInit.accountKey,
              balance: token?.balanceParsed,
              cache,
              token,
            }),
          initialBalanceDisplayCache,
        );
        let initialStockSelectedToken: ISwapToken | undefined;
        if (initialSelectedTokensOnInit.fromToken?.isStock) {
          initialStockSelectedToken = initialSelectedTokensOnInit.fromToken;
        } else if (initialToToken?.isStock) {
          initialStockSelectedToken = initialToToken;
        }

        hasInitializedSelectedTokensRef.current = true;
        store.set(
          swapSelectFromTokenAtom(),
          initialSelectedTokensOnInit.fromToken,
        );
        store.set(swapSelectToTokenAtom(), initialToToken);
        if (seededBalanceDisplayCache !== initialBalanceDisplayCache) {
          store.set(swapBalanceDisplayCacheAtom(), seededBalanceDisplayCache);
        }
        store.set(swapStockSelectedTokenAtom(), initialStockSelectedToken);
        store.set(swapSelectedTokensColdStartContextAtom(), entryContext);
        store.set(swapInitialSelectedTokensSyncedAtom(), true);
        store.set(swapFromTokenAmountAtom(), { value: '', isInput: false });
        store.set(swapTypeSwitchAtom(), initialSwapType);
      } else {
        hasInitializedSelectedTokensRef.current =
          hydrateSwapDefaultTokensFromGlobalHomeSnapshot(store);
      }
    }

    return (
      <>
        <JotaiContextStoreMirrorTracker {...data} />
        <ProviderJotaiContextSwap store={store}>
          <SwapProviderMirrorColdStartCacheSync />
          {children}
        </ProviderJotaiContextSwap>
      </>
    );
  },
);
SwapProviderMirror.displayName = 'SwapProviderMirror';
