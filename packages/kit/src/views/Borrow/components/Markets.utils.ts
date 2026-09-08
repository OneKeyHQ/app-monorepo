import { EBorrowDataStatus } from '../borrowDataStatus';

export function isBorrowMarketChangeCancelled({
  targetMarketKey,
  requestedMarketKey,
  currentMarketKey,
}: {
  targetMarketKey: string;
  requestedMarketKey?: string;
  currentMarketKey?: string;
}) {
  return (
    targetMarketKey !== requestedMarketKey &&
    targetMarketKey !== currentMarketKey
  );
}

export function isBorrowMarketChangeSettled({
  targetMarketKey,
  currentMarketKey,
  reservesOwnerMarketKey,
  dataStatus,
}: {
  targetMarketKey: string;
  currentMarketKey?: string;
  reservesOwnerMarketKey?: string;
  dataStatus: EBorrowDataStatus;
}) {
  return (
    targetMarketKey === currentMarketKey &&
    targetMarketKey === reservesOwnerMarketKey &&
    (dataStatus === EBorrowDataStatus.Ready ||
      dataStatus === EBorrowDataStatus.Error)
  );
}
