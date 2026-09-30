export type IDeFiListLoadingState = {
  isRefreshing: boolean;
  initialized: boolean;
  loadedOwnerKey?: string;
};

export type IDeFiListLoadingEvent =
  | { type: 'start' }
  | { type: 'settled'; loadedOwnerKey?: string }
  | { type: 'error'; error: unknown; loadedOwnerKey?: string };

const TERMINAL: IDeFiListLoadingState = {
  isRefreshing: false,
  initialized: true,
};

const LOADING: IDeFiListLoadingState = {
  isRefreshing: true,
  initialized: false,
  loadedOwnerKey: undefined,
};

export function deFiListLoadingReducer(
  event: IDeFiListLoadingEvent,
): IDeFiListLoadingState {
  switch (event.type) {
    case 'start':
      return LOADING;
    case 'settled':
    case 'error':
      return {
        ...TERMINAL,
        loadedOwnerKey: event.loadedOwnerKey,
      };
    default: {
      const _exhaustive: never = event;
      return _exhaustive;
    }
  }
}

export function shouldShowDeFiEmptyState({
  initialized,
  isRefreshing,
  loadedOwnerKey,
  ownerKey,
  protocolsLength,
}: {
  initialized: boolean;
  isRefreshing: boolean;
  loadedOwnerKey?: string;
  ownerKey?: string;
  protocolsLength: number;
}) {
  return (
    protocolsLength === 0 &&
    initialized &&
    !isRefreshing &&
    Boolean(ownerKey) &&
    loadedOwnerKey === ownerKey
  );
}

// Whether the all-network DeFi fan-out may run for `ownerKey`. The list
// instance is granted per owner, so the render that switches owners is gated
// like a fresh mount. The header's cache-only instance keeps any grant through
// that render: it only reads local caches and publishes nothing the list
// consumes, and running right away is what gives the header the cached value.
export function isDeFiAllNetworkRequestsGranted({
  refreshCacheOnly,
  grantedOwnerKey,
  ownerKey,
}: {
  refreshCacheOnly: boolean;
  grantedOwnerKey?: string;
  ownerKey?: string;
}) {
  if (refreshCacheOnly) {
    return grantedOwnerKey !== undefined;
  }
  return Boolean(ownerKey) && grantedOwnerKey === ownerKey;
}

// A published all-network result is applied under the owner it was published
// for. The hook keeps returning the previous owner's result until the next
// owner's fan-out lands, so an owner switch alone must not re-apply it.
export function shouldApplyDeFiAllNetworksResult<T>({
  applied,
  result,
  ownerKey,
}: {
  applied?: { result: T; ownerKey?: string };
  result: T;
  ownerKey?: string;
}) {
  return !(applied?.result === result && applied.ownerKey !== ownerKey);
}

// State written when an all-network fan-out finishes. The hook calls
// `onFinished` before it publishes the result, so when the run returned
// positions the owner is not stamped loaded yet: the result effect does that
// in the commit that fills the list, keeping the skeleton (not the empty
// state) in between. Without positions nothing else will settle the owner.
export function resolveDeFiFanOutFinishedState({
  positionsOwnerKey,
  finishedOwnerKey,
}: {
  positionsOwnerKey?: string;
  finishedOwnerKey?: string;
}): Partial<IDeFiListLoadingState> {
  if (
    positionsOwnerKey !== undefined &&
    positionsOwnerKey === finishedOwnerKey
  ) {
    return { initialized: true, isRefreshing: false };
  }
  return deFiListLoadingReducer({
    type: 'settled',
    loadedOwnerKey: finishedOwnerKey,
  });
}

// Whether an all-network run start marks the header's DeFi readiness unknown.
// Readiness is recorded per owner, so another owner's state already reads as
// not ready. Downgrading the same owner while its cached value is showing
// only drops the header back to its held total until the run's cache probe
// marks it ready again.
export function shouldResetDeFiReadinessOnRunStart({
  readiness,
  ownerKey,
}: {
  readiness: { ownerKey: string; isReady?: boolean };
  ownerKey: string;
}) {
  return !(
    Boolean(ownerKey) &&
    readiness.ownerKey === ownerKey &&
    readiness.isReady === true
  );
}

export type IDeFiCacheProbeAction =
  | 'skip'
  | 'mark-ready'
  | 'mark-not-cached'
  | 'zero-overview';

// What the all-network cache probe writes to the header's DeFi overview once
// it knows whether anything is cached for the run's network set.
//
// - A run whose owner is no longer live writes nothing: the overview and its
//   readiness are a single slot the live owner's own probe has stamped.
// - A hit marks the owner ready; `allNetworkCacheData` follows and replaces
//   the overview with the cached sum.
// - A miss is reported as `isReady: false`. The header counts any defined
//   readiness as "DeFi reported for this owner" and releases its hold onto
//   the live token total; on the spot tab the cache-only instance is the only
//   readiness writer and issues no fan-out, so a miss left unknown
//   (`undefined`) would pin the header to its persisted total until the
//   token commit and the grace timer — or for the whole session when no
//   commit lands (OK-64028 follow-up: account switch never refreshed).
//   What happens to the overview `clearAllNetworkData` kept for this owner
//   depends on why nothing is cached. After an enabled-network change the
//   kept value was summed over the previous set — it still counts the
//   disabled network — and a miss means nothing is cached for any network of
//   the current set, so it is zeroed: 0 is the best-known total until a
//   fan-out (if any) adds positions. Any other miss keeps it: it is the
//   last-known total for the current set, and a fan-out whose every request
//   fails should fall back to it, not to 0.
export function resolveDeFiCacheProbeAction({
  hasCache,
  overviewPredatesEnabledSet,
  runOwnerKey,
  liveOwnerKey,
}: {
  hasCache: boolean;
  /** The enabled network set changed since a run last settled the overview. */
  overviewPredatesEnabledSet: boolean;
  runOwnerKey?: string;
  liveOwnerKey?: string;
}): IDeFiCacheProbeAction {
  if (!runOwnerKey || runOwnerKey !== liveOwnerKey) {
    return 'skip';
  }
  if (hasCache) {
    return 'mark-ready';
  }
  return overviewPredatesEnabledSet ? 'zero-overview' : 'mark-not-cached';
}
