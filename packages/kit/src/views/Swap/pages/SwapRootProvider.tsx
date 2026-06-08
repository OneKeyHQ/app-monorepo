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
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapSelectedTokensColdStartContextAtom,
  useSwapTypeSwitchAtom,
} from '../../../states/jotai/contexts/swap';
import { useJotaiContextRootStore } from '../../../states/jotai/utils/useJotaiContextRootStore';
import { shouldClearSwapSelectedTokensOnHomeAccountUpdate } from '../utils/swapColdStartTokenCacheUtils';

function SwapColdStartCacheSync() {
  const [, setSwapTypeSwitch] = useSwapTypeSwitchAtom();
  const [, setSwapFromToken] = useSwapSelectFromTokenAtom();
  const [, setSwapToToken] = useSwapSelectToTokenAtom();
  const [selectedTokensColdStartContext, setSelectedTokensColdStartContext] =
    useSwapSelectedTokensColdStartContextAtom();
  const selectedTokensColdStartContextRef = useRef(
    selectedTokensColdStartContext,
  );
  selectedTokensColdStartContextRef.current = selectedTokensColdStartContext;

  useEffect(() => {
    const clearSelectedTokens = () => {
      setSwapFromToken(undefined);
      setSwapToToken(undefined);
      setSelectedTokensColdStartContext(undefined);
      setSwapTypeSwitch(ESwapTabSwitchType.SWAP);
    };

    const handleHomeSelectedAccountUpdate = (eventPayload: {
      selectedAccount?: IAccountSelectorSelectedAccount;
      sceneName: EAccountSelectorSceneName;
      num: number;
    }) => {
      if (
        shouldClearSwapSelectedTokensOnHomeAccountUpdate({
          cachedContext: selectedTokensColdStartContextRef.current,
          eventPayload,
        })
      ) {
        clearSelectedTokens();
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
  return <ProviderJotaiContextSwap store={store} />;
});
SwapModalRootProvider.displayName = 'SwapModalRootProvider';
