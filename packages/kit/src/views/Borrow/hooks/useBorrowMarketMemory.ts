import { useCallback, useEffect, useRef } from 'react';

import { useBorrowSelectedMarketAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IBorrowMarketItem } from '@onekeyhq/shared/types/staking';

import { buildBorrowMarketKey } from '../borrowMarketKey';

import { resolveRememberedBorrowMarket } from './borrowMarketMemory.utils';

/**
 * Carries the market choice across sessions. Must be used exactly once: the
 * flags below are per-instance, and a second instance would not see the first
 * one's writes.
 *
 * Only an explicit pick is written. The selection is also reconciled
 * automatically against each refresh, and persisting that fallback would
 * overwrite the user's market whenever the backend omitted it once.
 */
export function useBorrowMarketMemory({
  markets,
  market,
  setMarket,
}: {
  markets: IBorrowMarketItem[];
  market: IBorrowMarketItem | null;
  setMarket: (next: IBorrowMarketItem) => void;
}) {
  const [{ marketKey: rememberedKey }, setSelectedMarket] =
    useBorrowSelectedMarketAtom();
  const hasUserChosenRef = useRef(false);
  const hasRestoredRef = useRef(false);

  const rememberMarket = useCallback(
    (nextMarket: IBorrowMarketItem) => {
      hasUserChosenRef.current = true;
      void setSelectedMarket({ marketKey: buildBorrowMarketKey(nextMarket) });
    },
    [setSelectedMarket],
  );

  useEffect(() => {
    const remembered = resolveRememberedBorrowMarket({
      markets,
      rememberedKey,
      hasUserChosen: hasUserChosenRef.current,
      hasRestored: hasRestoredRef.current,
      currentMarket: market,
    });
    if (!remembered) {
      return;
    }
    hasRestoredRef.current = true;
    setMarket(remembered);
  }, [market, markets, rememberedKey, setMarket]);

  return { rememberMarket, rememberedMarketKey: rememberedKey };
}
