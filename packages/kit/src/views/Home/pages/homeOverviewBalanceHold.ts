export interface IHomeOverviewBalanceHoldInput {
  isAllNetworks: boolean;
  /** A confirmed balance for this owner exists (persisted or from this session). */
  hasConfirmedBalance: boolean;
  /** Token worth for this owner has at least one network value. */
  isTokenWorthReady: boolean;
  /**
   * The token side has committed a COMPLETE snapshot for this owner
   * (`accountWorth.updateAll`): cache hydrate or an authoritative fan-out
   * commit, as opposed to per-network progressive merges.
   */
  isTokenSnapshotCommitted: boolean;
  /** `overviewDeFiDataState.isReady !== undefined` for this owner. */
  isDeFiReady: boolean;
  /**
   * The DeFi list run for this owner is in flight. Its start resets DeFi
   * readiness and its finish always writes it back, so readiness is on its
   * way; the grace must not start from a stale token commit meanwhile.
   */
  isDeFiRefreshing: boolean;
  /** The DeFi grace timer armed after the token commit has elapsed. */
  deFiGraceExpired: boolean;
}

export interface IHomeOverviewBalanceHoldPlan {
  /** Keep showing the previously confirmed balance. */
  shouldHold: boolean;
  /** Arm (or keep) the DeFi grace timer for the current owner. */
  shouldArmDeFiGrace: boolean;
}

/**
 * Decide whether the All Networks header keeps the previously confirmed
 * balance instead of the live, progressively merged total.
 *
 * The hold keeps the header from climbing network by network while a fan-out
 * is in flight. It used to release only when BOTH token and DeFi readiness
 * were true, and DeFi readiness is written solely inside the cache-only DeFi
 * hook's run. When that run does not happen, the header stayed pinned to a
 * stale persisted total for the whole session while the token list already
 * showed live values. The hold is therefore bounded: once the token side has
 * committed a complete snapshot, DeFi gets a short grace window and then the
 * live total is shown with whatever DeFi value is currently known.
 *
 * `updateAll` is never reset by a warm refresh, so the token commit alone
 * cannot tell a fresh snapshot from the previous one. While a DeFi run is in
 * flight its readiness was reset by that run and will be written back when it
 * finishes; starting the grace then would drop DeFi from the header after the
 * window even though it is merely reloading. The grace therefore only arms
 * when DeFi is neither ready nor refreshing, i.e. when nothing is going to
 * report it.
 */
export function resolveHomeOverviewBalanceHold({
  isAllNetworks,
  hasConfirmedBalance,
  isTokenWorthReady,
  isTokenSnapshotCommitted,
  isDeFiReady,
  isDeFiRefreshing,
  deFiGraceExpired,
}: IHomeOverviewBalanceHoldInput): IHomeOverviewBalanceHoldPlan {
  if (!isAllNetworks) {
    return { shouldHold: false, shouldArmDeFiGrace: false };
  }
  const shouldArmDeFiGrace =
    isTokenSnapshotCommitted && !isDeFiReady && !isDeFiRefreshing;
  const isReleased =
    isTokenWorthReady &&
    (isDeFiReady || (isTokenSnapshotCommitted && deFiGraceExpired));
  return {
    shouldHold: hasConfirmedBalance && !isReleased,
    shouldArmDeFiGrace,
  };
}

/**
 * Whether the header total may include the DeFi value currently held in the
 * overview atom. Readiness only says the DeFi hook reported for this owner
 * this session. Once the grace has released the hold without it, the last
 * value written for the SAME owner is still the best-known DeFi total — the
 * warm token refresh never clears it — and zeroing it would make the header
 * drop by the whole DeFi position until DeFi reports again.
 */
export function shouldIncludeKnownDeFiWorth({
  isAllNetworks,
  isDeFiReady,
  deFiGraceExpired,
  isDeFiOverviewOwnerMatched,
}: {
  isAllNetworks: boolean;
  isDeFiReady: boolean;
  deFiGraceExpired: boolean;
  /** The overview atom is stamped with the current owner. */
  isDeFiOverviewOwnerMatched: boolean;
}): boolean {
  if (!isAllNetworks || isDeFiReady) {
    return true;
  }
  return deFiGraceExpired && isDeFiOverviewOwnerMatched;
}
