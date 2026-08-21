import type { ESwapDirection } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/SwapPanel/hooks/useTradeType';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';
import { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';

import { jotaiContextStore } from '../../utils/jotaiContextStore';

import {
  swapProDirectionAtom,
  swapProSelectTokenAtom,
  swapProUserSelectedTokenAtom,
  swapTypeSwitchAtom,
  swapUserSelectedTokensAtom,
} from './atoms';

export function prepareSwapProEntry({
  direction,
  token,
}: {
  direction: ESwapDirection;
  token: ISwapToken;
}) {
  const store = jotaiContextStore.prepareStoreForImmediateUse({
    storeName: EJotaiContextStoreNames.swap,
  });

  // A Market entry programmatically owns both sides of the transition. Clear
  // any earlier manual-selection markers before replacing the Pro target.
  store.set(swapUserSelectedTokensAtom(), undefined);
  store.set(swapProUserSelectedTokenAtom(), undefined);
  store.set(swapProSelectTokenAtom(), token);
  store.set(swapProDirectionAtom(), direction);
  store.set(swapTypeSwitchAtom(), ESwapTabSwitchType.LIMIT);
}
