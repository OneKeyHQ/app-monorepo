import { useCallback, useEffect, useRef } from 'react';

import { useBorrowSelectedMarketAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IBorrowMarketItem } from '@onekeyhq/shared/types/staking';

import { buildBorrowMarketKey } from '../borrowMarketKey';

import { resolveRememberedBorrowMarket } from './borrowMarketMemory.utils';

/**
 * Carries the market choice across sessions.
 *
 * Belongs to whoever owns the market state, and must be used exactly once:
 * `hasUserChosen` is per-instance, and a second instance would not see the
 * first one's writes — its restore would then fight the user's pick while the
 * persisted mirror is still catching up.
 *
 * Only an explicit pick is written. The selection is also reconciled
 * automatically — a refresh that no longer lists the current market falls back
 * to the first one — and persisting that would quietly overwrite the user's
 * market with the fallback whenever the backend omitted it once.
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
    // Storage hydrates asynchronously off native, so an empty key here means
    // "not loaded yet" as often as it means "nothing remembered"; this effect
    // stays armed until a real key arrives rather than resolving on first run.
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

  return { rememberMarket };
}
