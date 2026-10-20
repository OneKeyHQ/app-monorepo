import { useCallback, useEffect, useMemo, useRef } from 'react';

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
  preferredMarketKey,
}: {
  markets: IBorrowMarketItem[];
  market: IBorrowMarketItem | null;
  setMarket: (next: IBorrowMarketItem) => void;
  /** A market named by the route (the desktop home's market cards) */
  preferredMarketKey?: string;
}) {
  const [{ marketKey: rememberedKey }, setSelectedMarket] =
    useBorrowSelectedMarketAtom();
  const hasUserChosenRef = useRef(false);
  const hasRestoredRef = useRef(false);
  const appliedPreferredKeyRef = useRef<string | undefined>(undefined);

  const preferredMarket = useMemo(
    () =>
      preferredMarketKey
        ? markets.find(
            (item) => buildBorrowMarketKey(item) === preferredMarketKey,
          )
        : undefined,
    [markets, preferredMarketKey],
  );

  // Opening a named market is an explicit pick: it wins over the remembered
  // market and is saved, so the next plain visit lands on it too. The route
  // carries the market rather than the atom because the extension's UI copy
  // of the atom can lag behind a write.
  useEffect(() => {
    if (
      !preferredMarket ||
      !preferredMarketKey ||
      appliedPreferredKeyRef.current === preferredMarketKey
    ) {
      return;
    }
    appliedPreferredKeyRef.current = preferredMarketKey;
    hasUserChosenRef.current = true;
    void setSelectedMarket({ marketKey: preferredMarketKey });
    setMarket(preferredMarket);
  }, [preferredMarket, preferredMarketKey, setMarket, setSelectedMarket]);

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

  return {
    rememberMarket,
    // The gate lands on this key first, so a named market shows without a
    // frame of the remembered one
    rememberedMarketKey:
      preferredMarket && preferredMarketKey
        ? preferredMarketKey
        : rememberedKey,
  };
}
