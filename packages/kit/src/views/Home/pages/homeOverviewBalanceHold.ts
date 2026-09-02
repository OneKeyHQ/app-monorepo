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
 */
export function resolveHomeOverviewBalanceHold({
  isAllNetworks,
  hasConfirmedBalance,
  isTokenWorthReady,
  isTokenSnapshotCommitted,
  isDeFiReady,
  deFiGraceExpired,
}: IHomeOverviewBalanceHoldInput): IHomeOverviewBalanceHoldPlan {
  if (!isAllNetworks) {
    return { shouldHold: false, shouldArmDeFiGrace: false };
  }
  const shouldArmDeFiGrace = isTokenSnapshotCommitted && !isDeFiReady;
  const isReleased =
    isTokenWorthReady &&
    (isDeFiReady || (isTokenSnapshotCommitted && deFiGraceExpired));
  return {
    shouldHold: hasConfirmedBalance && !isReleased,
    shouldArmDeFiGrace,
  };
}
