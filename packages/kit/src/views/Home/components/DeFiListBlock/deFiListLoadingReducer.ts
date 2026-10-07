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
