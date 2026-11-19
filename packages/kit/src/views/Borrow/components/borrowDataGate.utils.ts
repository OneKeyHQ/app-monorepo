import { EBorrowDataStatus } from '../borrowDataStatus';

export const BORROW_DISPLAY_CACHE_MAX_AGE = 30 * 60 * 1000;
export const BORROW_MARKET_SKELETON_DELAY = 200;
export const BORROW_MARKET_SKELETON_MIN_DURATION = 300;

export function shouldHoldBorrowMarketSkeleton({
  skeletonMarketKey,
  skeletonStartedAt,
  targetMarketKey,
  requestedMarketKey,
  isTargetLoading = false,
  now,
}: {
  skeletonMarketKey: string | undefined;
  skeletonStartedAt: number | undefined;
  targetMarketKey: string | undefined;
  requestedMarketKey: string | undefined;
  isTargetLoading?: boolean;
  now: number;
}): boolean {
  return Boolean(
    skeletonMarketKey &&
    skeletonStartedAt !== undefined &&
    skeletonMarketKey === targetMarketKey &&
    (!requestedMarketKey || requestedMarketKey === skeletonMarketKey) &&
    now >= skeletonStartedAt &&
    (now - skeletonStartedAt < BORROW_MARKET_SKELETON_MIN_DURATION ||
      isTargetLoading),
  );
}

export function isBorrowSnapshotReusable({
  updatedAt,
  now,
  isAccountCacheReusable,
}: {
  updatedAt: number | undefined;
  now: number;
  isAccountCacheReusable: boolean;
}): boolean {
  return Boolean(
    updatedAt &&
    isAccountCacheReusable &&
    updatedAt <= now &&
    now - updatedAt < BORROW_DISPLAY_CACHE_MAX_AGE,
  );
}

export function isPreviousBorrowReservesSnapshotAvailable({
  previousData,
  previousFetchKey,
  currentFetchKey,
  updatedAt,
  now,
  isAccountCacheReusable,
}: {
  previousData: unknown;
  previousFetchKey: string | null;
  currentFetchKey: string | null;
  updatedAt: number | null;
  now: number;
  isAccountCacheReusable: boolean;
}) {
  return Boolean(
    previousFetchKey === currentFetchKey &&
    previousData &&
    isBorrowSnapshotReusable({
      updatedAt: updatedAt ?? undefined,
      now,
      isAccountCacheReusable,
    }),
  );
}

export function isBorrowEarnAccountLoading({
  isLoading,
  hasAccountContext,
  hasMarketNetwork,
  isAccountUnresolved,
}: {
  isLoading?: boolean;
  hasAccountContext: boolean;
  hasMarketNetwork: boolean;
  isAccountUnresolved: boolean;
}): boolean {
  return (
    Boolean(isLoading) ||
    (hasAccountContext && hasMarketNetwork && isAccountUnresolved)
  );
}

export function getBorrowStatusWhileTargetMetricsLoad({
  reservesStatus,
  areTargetMetricsPending,
}: {
  reservesStatus: EBorrowDataStatus;
  areTargetMetricsPending: boolean;
}) {
  if (
    areTargetMetricsPending &&
    (reservesStatus === EBorrowDataStatus.Ready ||
      reservesStatus === EBorrowDataStatus.Refreshing)
  ) {
    return EBorrowDataStatus.LoadingReserves;
  }
  return reservesStatus;
}

export function shouldPublishBorrowMarketChange({
  isMarketChangePending,
  dataStatus,
  hasOwnedReservesResult = false,
  showDelayedSkeleton = false,
}: {
  isMarketChangePending: boolean;
  dataStatus: EBorrowDataStatus;
  hasOwnedReservesResult?: boolean;
  showDelayedSkeleton?: boolean;
}): boolean {
  return (
    !isMarketChangePending ||
    showDelayedSkeleton ||
    dataStatus === EBorrowDataStatus.Error ||
    (hasOwnedReservesResult &&
      (dataStatus === EBorrowDataStatus.Ready ||
        dataStatus === EBorrowDataStatus.Refreshing))
  );
}

export function getBorrowReservesDataToPublish<T>({
  previousData,
  ownedData,
  hasReusableOwnedData,
  isFetchKeyChanged,
  dataStatus,
}: {
  previousData: T | null;
  ownedData: T | undefined;
  hasReusableOwnedData: boolean;
  isFetchKeyChanged: boolean;
  dataStatus: EBorrowDataStatus;
}): T | null {
  const usableOwnedData = hasReusableOwnedData ? ownedData : undefined;
  if (
    isFetchKeyChanged ||
    dataStatus === EBorrowDataStatus.LoadingMarkets ||
    dataStatus === EBorrowDataStatus.WaitingForAccount
  ) {
    return usableOwnedData ?? null;
  }
  if (
    (dataStatus === EBorrowDataStatus.Ready ||
      dataStatus === EBorrowDataStatus.Refreshing) &&
    usableOwnedData !== undefined
  ) {
    return usableOwnedData;
  }
  return previousData;
}

export function isCurrentBorrowReservesRequest({
  requestKey,
  currentKey,
  requestId,
  currentRequestId,
}: {
  requestKey: string;
  currentKey: string | null;
  requestId: number;
  currentRequestId: number;
}): boolean {
  return requestKey === currentKey && requestId === currentRequestId;
}

export function getOwnedBorrowReservesResult<T>({
  result,
  resultOwnerKey,
  currentKey,
}: {
  result: T | undefined;
  resultOwnerKey: string | null;
  currentKey: string | null;
}): T | undefined {
  if (!currentKey || resultOwnerKey !== currentKey) {
    return undefined;
  }
  return result;
}

export function shouldRefreshBorrowDataOnActivation({
  isViewActive,
  wasViewActive,
}: {
  isViewActive: boolean;
  wasViewActive: boolean;
}) {
  return isViewActive && !wasViewActive;
}
