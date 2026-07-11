import { prepareSwapProEntryCommand } from '@onekeyhq/kit/src/states/jotai/contexts/swap/actions';
import { jotaiContextStore } from '@onekeyhq/kit/src/states/jotai/utils/jotaiContextStore';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms/jotaiContextStoreMap';
import { ESwapProJumpTokenDirection } from '@onekeyhq/kit-bg/src/states/jotai/atoms/swap';
import { hydrateContextColdStartCacheForProvider } from '@onekeyhq/kit-bg/src/states/jotai/utils';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import { ESwapDirection } from '../../Market/MarketDetailV2/components/SwapPanel/hooks/useTradeType';

const SWAP_ROOT_COLD_START_SCOPE_KEY = `store:${EJotaiContextStoreNames.swap}`;

export function prepareSwapProEntryState({
  token,
  direction,
}: {
  token: ISwapToken;
  direction: ESwapProJumpTokenDirection;
}) {
  const store = jotaiContextStore.getOrCreateStore({
    storeName: EJotaiContextStoreNames.swap,
  });

  // Hydrate before the handoff so the first Provider mount cannot restore a
  // cached Swap tab over the synchronously prepared Pro state.
  hydrateContextColdStartCacheForProvider({
    store: store as unknown as Parameters<
      typeof hydrateContextColdStartCacheForProvider
    >[0]['store'],
    coldStartScopeKey: SWAP_ROOT_COLD_START_SCOPE_KEY,
  });

  void store.set(prepareSwapProEntryCommand.atom(), {
    direction:
      direction === ESwapProJumpTokenDirection.SELL
        ? ESwapDirection.SELL
        : ESwapDirection.BUY,
    token,
  });
}
