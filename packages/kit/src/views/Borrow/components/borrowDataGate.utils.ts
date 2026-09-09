import { EBorrowDataStatus } from '../borrowDataStatus';

export function shouldPublishBorrowMarketChange({
  isMarketChangePending,
  dataStatus,
}: {
  isMarketChangePending: boolean;
  dataStatus: EBorrowDataStatus;
}): boolean {
  return (
    !isMarketChangePending ||
    dataStatus === EBorrowDataStatus.Ready ||
    dataStatus === EBorrowDataStatus.Error
  );
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
