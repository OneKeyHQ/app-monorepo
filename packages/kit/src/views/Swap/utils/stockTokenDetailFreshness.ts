import type {
  IMarketPerpsInfo,
  IMarketTokenDetail,
} from '@onekeyhq/shared/types/marketV2';

export type IStockTokenDetailFetchState = {
  scope: string;
  token: IMarketTokenDetail | undefined;
  perpsInfo: IMarketPerpsInfo | undefined;
  // Wall-clock time of the successful fetch that produced this payload.
  // Carried INSIDE the payload on purpose: usePromiseResult re-persists
  // whatever the method returns to the SWR cache with a fresh entry
  // timestamp — including the error fallback — so the cache entry's own
  // timestamp cannot bound staleness across remounts. Only fetchedAt is
  // trusted by the TTL check.
  fetchedAt?: number;
  // Set (instead of fetchedAt) on the post-TTL error fallback. The empty
  // fallback must settle the CURRENT mount to MarketUnavailable after an
  // extended outage, but once persisted to the SWR cache and hydrated
  // back on a later mount it must NOT claim unavailable before the first
  // real request resolves (the backend may have recovered) — so it only
  // counts as landed while the mount that produced it is still alive.
  fallbackOfMountId?: string;
};

/**
 * Decides whether a stock token-detail state is authoritative ("landed")
 * for the given scope. Anything not landed keeps the channel pending
 * (Initializing) until a real request resolves.
 *
 * Invariants (each guarded by a unit test; all shipped in OK-57346):
 * 1. A payload lands only with a real-response fetchedAt within the TTL —
 *    token payloads and genuine empty answers alike. This gates the SWR
 *    first-frame hydration: a stale cached isOpen/description must not
 *    drive the closed alert / trade button while a request is in flight.
 * 2. The cache entry's own timestamp is never consulted; it is re-stamped
 *    whenever the error fallback is re-persisted, which would otherwise
 *    renew the TTL indefinitely across remounts.
 * 3. The post-TTL error fallback (no fetchedAt) lands only within the
 *    mount that produced it, so an extended outage settles to a stable
 *    MarketUnavailable instead of an endless spinner.
 * 4. That same fallback hydrated on a later mount carries a foreign mount
 *    id and does NOT land — the backend may have recovered, so the first
 *    real response decides.
 */
export function isStockTokenDetailStateLanded({
  state,
  scope,
  mountId,
  ttlMs,
  now = Date.now(),
}: {
  state: IStockTokenDetailFetchState | undefined;
  scope: string;
  mountId: string;
  ttlMs: number;
  now?: number;
}): boolean {
  if (!state || state.scope !== scope) {
    return false;
  }
  if (state.fetchedAt && now - state.fetchedAt <= ttlMs) {
    return true;
  }
  return !!mountId && state.fallbackOfMountId === mountId;
}
