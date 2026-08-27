export enum EBorrowDataStatus {
  Idle = 'Idle',
  LoadingMarkets = 'LoadingMarkets',
  WaitingForAccount = 'WaitingForAccount',
  LoadingReserves = 'LoadingReserves',
  Refreshing = 'Refreshing',
  Ready = 'Ready',
}

// Single source of truth for "the cards must show a skeleton". Every consumer
// used to spell this set out, so a status that means "nothing has loaded yet"
// only had to be missed in one copy for the cards to paint their real empty
// copy for a frame (OK-60105 and the entry flash QA filmed after it).
export function isBorrowDataLoading(status: EBorrowDataStatus) {
  return (
    status === EBorrowDataStatus.LoadingMarkets ||
    status === EBorrowDataStatus.WaitingForAccount ||
    status === EBorrowDataStatus.LoadingReserves
  );
}
