/**
 * Offsets, from the moment a position's pending transactions clear, at which
 * the detail page re-reads the provider.
 *
 * useStakingPendingTxs fires one refresh 3s after the clear. Several providers
 * answer the detail request from their own index rather than the chain
 * (Everstake's API, Stakefish SOL's index, Ethena's ledger), and that single
 * read can land before the index has seen the transaction. Nothing tried
 * again, so a first deposit never grew a Portfolio tab until the page was
 * reopened. The wallet's DeFi tab covers the same lag with delayed force
 * refreshes after a confirmation; this is that idea on the page's own read.
 */
export const DETAIL_SETTLE_REFRESH_OFFSETS_MS = [10_000, 30_000, 60_000];

/**
 * Runs `refresh` now and again at each offset. `shouldStop` is asked before
 * every delayed run so a page that has already caught up (the Portfolio tab
 * appeared) does not keep hitting the server. Returns a cancel function.
 */
export function scheduleSettleRefreshes({
  refresh,
  shouldStop,
  offsetsMs = DETAIL_SETTLE_REFRESH_OFFSETS_MS,
}: {
  refresh: () => void;
  shouldStop?: () => boolean;
  offsetsMs?: number[];
}): () => void {
  refresh();
  const timers = offsetsMs.map((offset) =>
    setTimeout(() => {
      if (shouldStop?.()) {
        return;
      }
      refresh();
    }, offset),
  );
  return () => {
    timers.forEach((timer) => clearTimeout(timer));
  };
}
