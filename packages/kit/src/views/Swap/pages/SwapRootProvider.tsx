import { memo, useEffect, useMemo, useRef } from 'react';

import type { IAccountSelectorSelectedAccount } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityAccountSelector';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';

import {
  ProviderJotaiContextSwap,
  useSwapFromTokenAmountAtom,
  useSwapInitialSelectedTokensSyncedAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapSelectedTokensColdStartContextAtom,
  useSwapToTokenAmountAtom,
  useSwapTypeSwitchAtom,
} from '../../../states/jotai/contexts/swap';
import { useJotaiContextRootStore } from '../../../states/jotai/utils/useJotaiContextRootStore';
import {
  SWAP_COLD_START_HOME_SCENE_NAME,
  buildSwapDefaultSelectedTokensFromHomeAccount,
  shouldHandleSwapColdStartHomeAccountUpdate,
  shouldPreserveSwapUserInputAmountOnAccountSwitch,
  shouldPreserveSwapUserInputOnAccountSwitch,
} from '../utils/swapColdStartTokenCacheUtils';
import { hydrateSwapDefaultTokensFromGlobalHomeSnapshot } from '../utils/swapRootColdStartUtils';
import { getVisibleSwapTabSwitchType } from '../utils/swapTypeUtils';

export { hydrateSwapDefaultTokensFromGlobalHomeSnapshot } from '../utils/swapRootColdStartUtils';

function SwapColdStartCacheSync() {
  const [swapTypeSwitch, setSwapTypeSwitch] = useSwapTypeSwitchAtom();
  const [swapFromToken, setSwapFromToken] = useSwapSelectFromTokenAtom();
  const [swapToToken, setSwapToToken] = useSwapSelectToTokenAtom();
  const [fromTokenAmount] = useSwapFromTokenAmountAtom();
  const [toTokenAmount] = useSwapToTokenAmountAtom();
  const [initialSelectedTokensSynced, setInitialSelectedTokensSynced] =
    useSwapInitialSelectedTokensSyncedAtom();
  const [selectedTokensColdStartContext, setSelectedTokensColdStartContext] =
    useSwapSelectedTokensColdStartContextAtom();
  const selectedTokensColdStartContextRef = useRef(
    selectedTokensColdStartContext,
  );
  selectedTokensColdStartContextRef.current = selectedTokensColdStartContext;
  const initialSelectedTokensSyncedRef = useRef(initialSelectedTokensSynced);
  initialSelectedTokensSyncedRef.current = initialSelectedTokensSynced;
  const swapTypeSwitchRef = useRef(swapTypeSwitch);
  swapTypeSwitchRef.current = swapTypeSwitch;
  const swapFromTokenRef = useRef(swapFromToken);
  swapFromTokenRef.current = swapFromToken;
  const swapToTokenRef = useRef(swapToToken);
  swapToTokenRef.current = swapToToken;
  const fromTokenAmountRef = useRef(fromTokenAmount);
  fromTokenAmountRef.current = fromTokenAmount;
  const toTokenAmountRef = useRef(toTokenAmount);
  toTokenAmountRef.current = toTokenAmount;

  useEffect(() => {
    const markInitialSelectedTokensSynced = () => {
      if (initialSelectedTokensSyncedRef.current) {
        return;
      }
      initialSelectedTokensSyncedRef.current = true;
      setInitialSelectedTokensSynced(true);
    };

    const clearSelectedTokens = () => {
      setSwapFromToken(undefined);
      setSwapToToken(undefined);
      setSelectedTokensColdStartContext(undefined);
      markInitialSelectedTokensSynced();
    };

    const setDefaultSelectedTokensFromHomeAccount = (
      selectedAccount?: IAccountSelectorSelectedAccount,
    ) => {
      const defaultTokens = buildSwapDefaultSelectedTokensFromHomeAccount({
        homeSelectedAccount: selectedAccount,
        swapType: swapTypeSwitchRef.current,
      });
      if (!defaultTokens) {
        return false;
      }

      setSwapFromToken(defaultTokens.fromToken);
      setSwapToToken(defaultTokens.toToken);
      setSelectedTokensColdStartContext(defaultTokens.context);
      setSwapTypeSwitch(
        getVisibleSwapTabSwitchType(defaultTokens.swapType) ??
          defaultTokens.swapType,
      );
      return true;
    };

    const handleHomeSelectedAccountUpdate = (eventPayload: {
      selectedAccount?: IAccountSelectorSelectedAccount;
      sceneName: EAccountSelectorSceneName;
      num: number;
    }) => {
      if (
        eventPayload.sceneName !== SWAP_COLD_START_HOME_SCENE_NAME ||
        eventPayload.num !== 0
      ) {
        return;
      }
      if (
        shouldPreserveSwapUserInputAmountOnAccountSwitch({
          fromTokenAmount: fromTokenAmountRef.current,
          toTokenAmount: toTokenAmountRef.current,
        })
      ) {
        markInitialSelectedTokensSynced();
        return;
      }
      if (
        shouldPreserveSwapUserInputOnAccountSwitch({
          fromTokenAmount: fromTokenAmountRef.current,
          hasSelectedTokens: Boolean(
            swapFromTokenRef.current || swapToTokenRef.current,
          ),
          toTokenAmount: toTokenAmountRef.current,
        })
      ) {
        markInitialSelectedTokensSynced();
        return;
      }
      if (
        shouldHandleSwapColdStartHomeAccountUpdate({
          cachedContext: selectedTokensColdStartContextRef.current,
          eventPayload,
          hasSelectedTokens: Boolean(
            swapFromTokenRef.current || swapToTokenRef.current,
          ),
          initialSelectedTokensSynced: initialSelectedTokensSyncedRef.current,
        })
      ) {
        if (swapTypeSwitchRef.current === ESwapTabSwitchType.STOCK) {
          markInitialSelectedTokensSynced();
          return;
        }
        if (
          !setDefaultSelectedTokensFromHomeAccount(eventPayload.selectedAccount)
        ) {
          clearSelectedTokens();
        }
      }
    };

    appEventBus.on(
      EAppEventBusNames.AccountSelectorSelectedAccountUpdate,
      handleHomeSelectedAccountUpdate,
    );

    // The event is not guaranteed to arrive. saveToStorage short circuits when
    // the record on disk already matches, which is the normal case whenever
    // another runtime or scene wrote it first - on extension the popup and the
    // side panel are separate runtimes, and the popup dies without a
    // beforeunload. Read the home selection once on mount so a cold start that
    // never sees an event still leaves the placeholder tokens behind.
    let isActive = true;
    void import('../utils/swapHomeSelectedAccountUtils')
      .then(({ getLatestHomeSelectedAccount }) =>
        getLatestHomeSelectedAccount(),
      )
      .then((homeSelectedAccount) => {
        if (!isActive || initialSelectedTokensSyncedRef.current) {
          return;
        }
        handleHomeSelectedAccountUpdate({
          num: 0,
          sceneName: SWAP_COLD_START_HOME_SCENE_NAME,
          selectedAccount: homeSelectedAccount,
        });
      })
      .catch(() => undefined);

    return () => {
      isActive = false;
      appEventBus.off(
        EAppEventBusNames.AccountSelectorSelectedAccountUpdate,
        handleHomeSelectedAccountUpdate,
      );
    };
  }, [
    setInitialSelectedTokensSynced,
    setSelectedTokensColdStartContext,
    setSwapFromToken,
    setSwapToToken,
    setSwapTypeSwitch,
  ]);

  return null;
}

export function useSwapContextStoreInitData(
  storeName: EJotaiContextStoreNames,
) {
  const data = useMemo(
    () => ({
      storeName,
    }),
    [storeName],
  );
  return data;
}

export const SwapRootProvider = memo(() => {
  const data = useSwapContextStoreInitData(EJotaiContextStoreNames.swap);
  const store = useJotaiContextRootStore(data);
  const hasHydratedDefaultsRef = useRef(false);
  if (!hasHydratedDefaultsRef.current) {
    hasHydratedDefaultsRef.current = true;
    hydrateSwapDefaultTokensFromGlobalHomeSnapshot(store);
  }
  return (
    <ProviderJotaiContextSwap store={store}>
      <SwapColdStartCacheSync />
    </ProviderJotaiContextSwap>
  );
});
SwapRootProvider.displayName = 'SwapRootProvider';

export const SwapModalRootProvider = memo(() => {
  const data = useSwapContextStoreInitData(EJotaiContextStoreNames.swapModal);
  const store = useJotaiContextRootStore(data);
  return (
    <ProviderJotaiContextSwap store={store}>
      <SwapColdStartCacheSync />
    </ProviderJotaiContextSwap>
  );
});
SwapModalRootProvider.displayName = 'SwapModalRootProvider';
