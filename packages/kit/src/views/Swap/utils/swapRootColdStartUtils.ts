import {
  swapDefaultConfigStatusAtom,
  swapFromTokenAmountAtom,
  swapInitialSelectedTokensSyncedAtom,
  swapNetworks,
  swapSelectFromTokenAtom,
  swapSelectToTokenAtom,
  swapSelectedTokensColdStartContextAtom,
  swapToTokenAmountAtom,
  swapTypeSwitchAtom,
} from '../../../states/jotai/contexts/swap/atoms';
import { getSwapDefaultSelectedTokensFromGlobalHomeSnapshot } from '../hooks/useSwapColdStartDisplayTokens';

import { shouldDeferSwapAutomaticDefaultTokens } from './swapColdStartTokenCacheUtils';
import { getVisibleSwapTabSwitchType } from './swapTypeUtils';

import type { createStore } from 'jotai';

type ISwapContextStore = ReturnType<typeof createStore>;

export function hydrateSwapDefaultTokensFromGlobalHomeSnapshot(
  store: ISwapContextStore,
) {
  const defaultConfigStatus = store.get(swapDefaultConfigStatusAtom());
  const cachedContext = store.get(swapSelectedTokensColdStartContextAtom());
  if (
    shouldDeferSwapAutomaticDefaultTokens({
      cachedContext,
      defaultConfigStatus,
      fromTokenAmount: store.get(swapFromTokenAmountAtom()),
      swapType: store.get(swapTypeSwitchAtom()),
      toTokenAmount: store.get(swapToTokenAmountAtom()),
    })
  ) {
    // Automatic defaults from a previous launch must not flash before the
    // current configuration request settles. User selections have no seed.
    store.set(swapSelectFromTokenAtom(), undefined);
    store.set(swapSelectToTokenAtom(), undefined);
    store.set(swapSelectedTokensColdStartContextAtom(), undefined);
    store.set(swapInitialSelectedTokensSyncedAtom(), false);
  }
  const hasSelectedTokens = Boolean(
    store.get(swapSelectFromTokenAtom()) || store.get(swapSelectToTokenAtom()),
  );
  if (hasSelectedTokens || store.get(swapInitialSelectedTokensSyncedAtom())) {
    return false;
  }

  const defaultTokens = getSwapDefaultSelectedTokensFromGlobalHomeSnapshot({
    defaultConfigStatus,
    swapType: store.get(swapTypeSwitchAtom()),
    swapNetworks: store.get(swapNetworks()),
  });
  if (!defaultTokens) {
    return false;
  }

  store.set(swapSelectFromTokenAtom(), defaultTokens.fromToken);
  store.set(swapSelectToTokenAtom(), defaultTokens.toToken);
  store.set(swapSelectedTokensColdStartContextAtom(), defaultTokens.context);
  store.set(
    swapTypeSwitchAtom(),
    getVisibleSwapTabSwitchType(defaultTokens.swapType) ??
      defaultTokens.swapType,
  );
  return true;
}
