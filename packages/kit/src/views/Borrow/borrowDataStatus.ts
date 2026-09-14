export enum EBorrowDataStatus {
  Initializing = 'Initializing',
  Idle = 'Idle',
  LoadingMarkets = 'LoadingMarkets',
  WaitingForAccount = 'WaitingForAccount',
  LoadingReserves = 'LoadingReserves',
  Refreshing = 'Refreshing',
  Ready = 'Ready',
  Error = 'Error',
}

export function deriveBorrowDataStatus({
  isViewActive,
  wasViewActive,
  hasCachedReserves,
  marketsLoading,
  hasMarket,
  hasFetchKey,
  shouldWaitForAccount,
  reservesLoading,
  isCurrentFetchKey,
  hasOwnedReservesResult,
  hasReservesError,
}: {
  isViewActive: boolean;
  wasViewActive: boolean;
  hasCachedReserves: boolean;
  marketsLoading: boolean;
  hasMarket: boolean;
  hasFetchKey: boolean;
  shouldWaitForAccount: boolean;
  reservesLoading?: boolean;
  isCurrentFetchKey: boolean;
  hasOwnedReservesResult: boolean;
  hasReservesError: boolean;
}) {
  if (!isViewActive) return EBorrowDataStatus.Idle;
  // Reactivation starts its refetch after render, before loading flags update.
  if (!wasViewActive && !hasCachedReserves) {
    return EBorrowDataStatus.LoadingMarkets;
  }
  if (marketsLoading) {
    if (!hasCachedReserves || !isCurrentFetchKey) {
      return EBorrowDataStatus.LoadingMarkets;
    }
    return EBorrowDataStatus.Refreshing;
  }
  if (!hasMarket) return EBorrowDataStatus.Idle;
  if (shouldWaitForAccount) return EBorrowDataStatus.WaitingForAccount;
  if (!hasFetchKey) return EBorrowDataStatus.Idle;

  // The request starts in a passive effect. Keep the new scope pending during
  // the render before usePromiseResult publishes its loading flag.
  if (!isCurrentFetchKey) {
    return EBorrowDataStatus.LoadingReserves;
  }

  if (reservesLoading) {
    if (!hasCachedReserves) {
      return EBorrowDataStatus.LoadingReserves;
    }
    return EBorrowDataStatus.Refreshing;
  }

  if (hasReservesError) {
    return hasCachedReserves
      ? EBorrowDataStatus.Ready
      : EBorrowDataStatus.Error;
  }

  if (hasOwnedReservesResult) {
    return EBorrowDataStatus.Ready;
  }

  // A valid active scope without a result is still waiting for its request.
  // Idle is reserved for inactive or unresolved market scopes.
  return hasCachedReserves
    ? EBorrowDataStatus.Ready
    : EBorrowDataStatus.LoadingReserves;
}

/**
 * The states in which there are no reserves to show yet. `Refreshing` is not
 * one of them: it means fresh data is on the way while the previous data is
 * still on screen, so callers must keep rendering rather than fall back to a
 * skeleton or an empty state. `Initializing` covers the provider's first
 * render, before BorrowDataGate publishes either an active loading state or
 * settled `Idle` state for an inactive or unresolved market scope.
 */
export function isBorrowReservesPending(status: EBorrowDataStatus) {
  return (
    status === EBorrowDataStatus.Initializing ||
    status === EBorrowDataStatus.LoadingMarkets ||
    status === EBorrowDataStatus.WaitingForAccount ||
    status === EBorrowDataStatus.LoadingReserves
  );
}
