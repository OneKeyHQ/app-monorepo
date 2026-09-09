import type { IBorrowMarketItem } from '@onekeyhq/shared/types/staking';

import { buildBorrowMarketKey } from '../borrowMarketKey';

/**
 * The remembered market to restore, or null to leave the current selection be.
 *
 * Restoring is deliberately one-shot per session. The persisted value is only
 * a hint about where the user left off: once they have picked a market here, or
 * once a restore has been honoured, later reads must not move the selection
 * again. On runtimes where UI atom writes are proxied to the background, the
 * local mirror echoes back the previous value for a while after a write, so a
 * restore that kept running would fight the user's own choice (the failure
 * recorded in `marketTabSelectionGuards.ts`).
 */
export function resolveRememberedBorrowMarket({
  markets,
  rememberedKey,
  hasUserChosen,
  hasRestored,
  currentMarket,
}: {
  markets: IBorrowMarketItem[];
  rememberedKey: string;
  hasUserChosen: boolean;
  hasRestored: boolean;
  currentMarket: IBorrowMarketItem | null;
}): IBorrowMarketItem | null {
  if (hasUserChosen || hasRestored || !rememberedKey || !markets.length) {
    return null;
  }
  const remembered = markets.find(
    (item) => buildBorrowMarketKey(item) === rememberedKey,
  );
  // A market can disappear from the list between sessions; the caller's own
  // fallback to the first entry already covers that.
  if (!remembered) {
    return null;
  }
  if (currentMarket && buildBorrowMarketKey(currentMarket) === rememberedKey) {
    return null;
  }
  return remembered;
}
