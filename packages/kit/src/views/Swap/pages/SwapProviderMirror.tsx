import { type PropsWithChildren, memo, useRef } from 'react';

import type { IAccountSelectorSelectedAccount } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityAccountSelector';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { isSwapSelectedTokensColdStartContextMatched } from '@onekeyhq/shared/src/utils/swapColdStartCacheSnapshotUtils';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import {
  ESwapTabSwitchType,
  type ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

import {
  type ISwapInputAmountDraft,
  ProviderJotaiContextSwap,
  swapBalanceDisplayCacheAtom,
  swapFromTokenAmountAtom,
  swapInitialSelectedTokensSyncedAtom,
  swapSelectFromTokenAtom,
  swapSelectToTokenAtom,
  swapSelectedFromTokenBalanceAtom,
  swapSelectedToTokenBalanceAtom,
  swapSelectedTokensColdStartContextAtom,
  swapStockSelectedTokenAtom,
  swapToTokenAmountAtom,
  swapTypeSwitchAtom,
  useSwapStockSelectedTokenAtom,
} from '../../../states/jotai/contexts/swap';
import { jotaiContextStore } from '../../../states/jotai/utils/jotaiContextStore';
import { JotaiContextStoreMirrorTracker } from '../../../states/jotai/utils/JotaiContextStoreMirrorTracker';
import { updateSwapBalanceDisplayCache } from '../utils/swapBalanceDisplayCacheUtils';
import { shouldPreserveSwapUserInputOnAccountSwitch } from '../utils/swapColdStartTokenCacheUtils';
import { shouldClearSwapSelectedTokensBeforeHomeAccountSync } from '../utils/swapDefaultTokenSeedUtils';
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
      homeSelectedAccountOnInit?: IAccountSelectorSelectedAccount | null;
      initialSelectedTokensOnInit?: {
        accountKey?: string;
        fromToken?: ISwapToken;
        toToken?: ISwapToken;
        swapType?: ESwapTabSwitchType;
        inputAmountDraft?: ISwapInputAmountDraft;
        preserveInputAmounts?: boolean;
      };
    },
  ) => {
    const {
      children,
      initialSelectedTokensOnInit,
      homeSelectedAccountOnInit,
      storeName,
    } = props;

    const data = useSwapContextStoreInitData(storeName);
    const store = jotaiContextStore.prepareStoreForImmediateUse(data);
    const hasInitializedSelectedTokensRef = useRef(false);
    if (!hasInitializedSelectedTokensRef.current) {
      if (homeSelectedAccountOnInit !== undefined) {
        const hasSelectedTokens = Boolean(
          store.get(swapSelectFromTokenAtom()) ||
          store.get(swapSelectToTokenAtom()),
        );
        if (
          store.get(swapTypeSwitchAtom()) === ESwapTabSwitchType.SWAP &&
          shouldClearSwapSelectedTokensBeforeHomeAccountSync({
            cachedContext: store.get(swapSelectedTokensColdStartContextAtom()),
            hasSelectedTokens,
            homeSelectedAccount: homeSelectedAccountOnInit ?? undefined,
            swapType: store.get(swapTypeSwitchAtom()),
            preserveSelectedTokens: shouldPreserveSwapUserInputOnAccountSwitch({
              hasSelectedTokens,
              fromTokenAmount: store.get(swapFromTokenAmountAtom()),
              toTokenAmount: store.get(swapToTokenAmountAtom()),
            }),
          })
        ) {
          store.set(swapSelectFromTokenAtom(), undefined);
          store.set(swapSelectToTokenAtom(), undefined);
          store.set(swapSelectedTokensColdStartContextAtom(), undefined);
          store.set(swapInitialSelectedTokensSyncedAtom(), false);
        }
        hasInitializedSelectedTokensRef.current = true;
      }
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
        const shouldKeepFromBalance = equalTokenNoCaseSensitive({
          token1: cachedFromToken,
          token2: initialSelectedTokensOnInit.fromToken,
        });
        const shouldKeepToBalance = equalTokenNoCaseSensitive({
          token1: cachedToToken,
          token2: initialToToken,
        });
        store.set(
          swapSelectFromTokenAtom(),
          initialSelectedTokensOnInit.fromToken,
        );
        store.set(swapSelectToTokenAtom(), initialToToken);
        if (!shouldKeepFromBalance) {
          store.set(
            swapSelectedFromTokenBalanceAtom(),
            initialSelectedTokensOnInit.fromToken?.balanceParsed ?? '',
          );
        }
        if (!shouldKeepToBalance) {
          store.set(
            swapSelectedToTokenBalanceAtom(),
            initialToToken?.balanceParsed ?? '',
          );
        }
        if (seededBalanceDisplayCache !== initialBalanceDisplayCache) {
          store.set(swapBalanceDisplayCacheAtom(), seededBalanceDisplayCache);
        }
        store.set(swapStockSelectedTokenAtom(), initialStockSelectedToken);
        store.set(swapSelectedTokensColdStartContextAtom(), entryContext);
        store.set(
          swapInitialSelectedTokensSyncedAtom(),
          storeName !== EJotaiContextStoreNames.swapHomeToken ||
            initialSwapType !== ESwapTabSwitchType.SWAP ||
            Boolean(initialStockSelectedToken) ||
            Boolean(initialToToken),
        );
        const shouldPreserveInputAmounts =
          initialSelectedTokensOnInit.preserveInputAmounts &&
          !initialSelectedTokensOnInit.inputAmountDraft &&
          (shouldKeepFromBalance ||
            (!cachedFromToken && !initialSelectedTokensOnInit.fromToken)) &&
          (shouldKeepToBalance || (!cachedToToken && !initialToToken)) &&
          store.get(swapTypeSwitchAtom()) === initialSwapType;
        if (!shouldPreserveInputAmounts) {
          store.set(
            swapFromTokenAmountAtom(),
            initialSelectedTokensOnInit.inputAmountDraft?.fromTokenAmount ?? {
              value: '',
              isInput: false,
            },
          );
        }
        if (initialSelectedTokensOnInit.inputAmountDraft) {
          store.set(
            swapToTokenAmountAtom(),
            initialSelectedTokensOnInit.inputAmountDraft.toTokenAmount,
          );
        } else if (
          initialSelectedTokensOnInit.preserveInputAmounts &&
          !shouldPreserveInputAmounts
        ) {
          store.set(swapToTokenAmountAtom(), { value: '', isInput: false });
        }
        store.set(swapTypeSwitchAtom(), initialSwapType);
      } else if (storeName === EJotaiContextStoreNames.swap) {
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
