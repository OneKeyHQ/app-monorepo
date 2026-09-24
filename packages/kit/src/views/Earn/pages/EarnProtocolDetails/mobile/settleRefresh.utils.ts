/**
 * Offsets, from the moment a position's pending transactions clear, at which
 * the detail page re-reads the provider on top of the one read
 * useStakingPendingTxs already fires 3s after the clear.
 *
 * Several providers answer the detail request from their own index rather
 * than the chain (Everstake's API, Stakefish SOL's index, Ethena's ledger),
 * and that single read can land before the index has seen the transaction.
 * The wallet's DeFi tab covers the same lag with delayed force refreshes after
 * a confirmation; this is that idea on the page's own read.
 */

/** A position that already existed: one more read as a fallback. */
export const DETAIL_BALANCE_SETTLE_REFRESH_OFFSETS_MS = [10_000];

/**
 * A vault with no position yet: the Portfolio tab appearing is the only sign
 * the deposit has landed, so keep re-reading for a while. The caller cancels
 * the schedule the moment the tab is up.
 */
export const DETAIL_PORTFOLIO_SETTLE_REFRESH_OFFSETS_MS = [
  10_000, 30_000, 60_000,
];

/** Runs `refresh` now and again at each offset. Returns a cancel function. */
export function scheduleSettleRefreshes({
  refresh,
  offsetsMs,
}: {
  refresh: () => void;
  offsetsMs: number[];
}): () => void {
  refresh();
  const timers = offsetsMs.map((offset) =>
    setTimeout(() => {
      refresh();
    }, offset),
  );
  return () => {
    timers.forEach((timer) => clearTimeout(timer));
  };
}
