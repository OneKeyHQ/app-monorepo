import type {
  IMarketPerpsInfo,
  IMarketTokenDetail,
} from '@onekeyhq/shared/types/marketV2';

export type IStockTokenDetailFetchState = {
  scope: string;
  token: IMarketTokenDetail | undefined;
  perpsInfo: IMarketPerpsInfo | undefined;
  // Identifies the current enabled token-detail lifecycle that actually
  // resolved this state. SWR hydration belongs to an older activation and is
  // display-only until the current request succeeds or fails.
  resolvedByActivationId?: string;
  // Keeps the last successful payload available for display after a
  // transient request failure without claiming that the latest poll landed.
  isUsingLastGood?: boolean;
  // Wall-clock time of the successful fetch that produced this payload.
  // Carried INSIDE the payload on purpose: usePromiseResult re-persists
  // whatever the method returns to the SWR cache with a fresh entry
  // timestamp — including the error fallback — so the cache entry's own
  // timestamp cannot bound staleness across remounts. Only fetchedAt is
  // trusted by the TTL check.
  fetchedAt?: number;
  // The empty post-TTL fallback settles only the mount that produced it.
  // Hydrating it into a later mount must remain pending until a new request.
  fallbackOfMountId?: string;
};

/**
 * Returns a scope-safe display seed without treating it as trade readiness.
 * Stale detail can keep the header, chart and market stats stable while the
 * channel independently revalidates market-open state before enabling trade.
 */
export function getStockTokenDetailDisplaySeed({
  state,
  scope,
}: {
  state: IStockTokenDetailFetchState | undefined;
  scope: string;
}) {
  if (state?.scope !== scope || !state.token?.stock) {
    return undefined;
  }
  return state.token;
}

/**
 * Decides whether a stock token-detail state is authoritative ("landed")
 * for the given scope. Anything not landed keeps the channel pending
 * (Initializing) until a real request resolves.
 *
 * Determines whether a payload is fresh enough for the main Stock channel.
 * A recent successful response may hydrate from SWR without flashing the
 * channel back to its initializing state.
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

/**
 * Determines whether the current enabled lifecycle produced the payload.
 * Swap/Bridge closed-market alerts use this stricter boundary so cached open
 * data cannot hide a new closed quote or trigger a re-quote loop.
 */
export function isStockTokenDetailStateResolvedForActivation({
  activationId,
  state,
  scope,
}: {
  activationId: string;
  state: IStockTokenDetailFetchState | undefined;
  scope: string;
}) {
  return Boolean(
    activationId &&
    state?.scope === scope &&
    state.resolvedByActivationId === activationId,
  );
}
