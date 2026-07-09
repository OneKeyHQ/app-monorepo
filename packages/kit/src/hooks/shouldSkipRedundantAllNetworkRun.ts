/**
 * L5 — decide whether a `usePromiseResult` re-fire of the all-network run is a
 * redundant SAME-owner repeat that can be skipped.
 *
 * usePromiseResult re-runs the fan-out whenever a dep identity changes; during
 * and right after an account switch the owner-derived callbacks churn and fire
 * extra full passes for the same settled owner. Skipping those saves redundant
 * fetches without ever dropping a needed refresh:
 * - `isMustRun` is true for every explicit refresh (all pass `alwaysSetState`;
 *   manual / add-account also pass `skipAccountsCache`) → never skipped.
 * - owner and enabled-network changes reset `allNetworkDataInit` → never skipped
 *   (and the signature differs anyway).
 * - the first run has no `lastSignature` → never skipped.
 */
export function shouldSkipRedundantAllNetworkRun(params: {
  isMustRun: boolean;
  allNetworkDataInit: boolean;
  currentSignature: string;
  lastSignature: string | null;
}): boolean {
  const { isMustRun, allNetworkDataInit, currentSignature, lastSignature } =
    params;
  if (isMustRun) {
    return false;
  }
  if (!allNetworkDataInit) {
    return false;
  }
  return lastSignature === currentSignature;
}
