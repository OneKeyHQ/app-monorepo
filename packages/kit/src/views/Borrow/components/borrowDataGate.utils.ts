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
