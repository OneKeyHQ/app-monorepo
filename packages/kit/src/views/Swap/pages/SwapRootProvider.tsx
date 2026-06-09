import { memo, useEffect, useMemo, useRef } from 'react';

import type { IAccountSelectorSelectedAccount } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityAccountSelector';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import {
  ProviderJotaiContextSwap,
  useSwapInitialSelectedTokensSyncedAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapSelectedTokensColdStartContextAtom,
  useSwapTypeSwitchAtom,
} from '../../../states/jotai/contexts/swap';
import { useJotaiContextRootStore } from '../../../states/jotai/utils/useJotaiContextRootStore';
import {
  buildSwapDefaultSelectedTokensFromHomeAccount,
  shouldHandleSwapColdStartHomeAccountUpdate,
} from '../utils/swapColdStartTokenCacheUtils';

function SwapColdStartCacheSync() {
  const [swapTypeSwitch, setSwapTypeSwitch] = useSwapTypeSwitchAtom();
  const [swapFromToken, setSwapFromToken] = useSwapSelectFromTokenAtom();
  const [swapToToken, setSwapToToken] = useSwapSelectToTokenAtom();
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
      setSwapTypeSwitch(defaultTokens.swapType);
      return true;
    };

    const handleHomeSelectedAccountUpdate = (eventPayload: {
      selectedAccount?: IAccountSelectorSelectedAccount;
      sceneName: EAccountSelectorSceneName;
      num: number;
    }) => {
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
    return () => {
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
