import {
  swapInitialSelectedTokensSyncedAtom,
  swapSelectFromTokenAtom,
  swapSelectToTokenAtom,
  swapSelectedTokensColdStartContextAtom,
  swapTypeSwitchAtom,
} from '../../../states/jotai/contexts/swap/atoms';
import { getSwapDefaultSelectedTokensFromGlobalHomeSnapshot } from '../hooks/useSwapColdStartDisplayTokens';

import { getVisibleSwapTabSwitchType } from './swapTypeUtils';

import type { createStore } from 'jotai';

type ISwapContextStore = ReturnType<typeof createStore>;

export function hydrateSwapDefaultTokensFromGlobalHomeSnapshot(
  store: ISwapContextStore,
) {
  const hasSelectedTokens = Boolean(
    store.get(swapSelectFromTokenAtom()) || store.get(swapSelectToTokenAtom()),
  );
  if (hasSelectedTokens || store.get(swapInitialSelectedTokensSyncedAtom())) {
    return false;
  }

  const defaultTokens = getSwapDefaultSelectedTokensFromGlobalHomeSnapshot({
    swapType: store.get(swapTypeSwitchAtom()),
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
