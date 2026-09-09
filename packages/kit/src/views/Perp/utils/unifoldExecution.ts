import type { IUnifoldExecutionStatus } from '@onekeyhq/shared/types/unifoldDeposit';

export function shouldEnableUnifoldLedgerUpdates({
  previousStatus,
  nextStatus,
}: {
  previousStatus: IUnifoldExecutionStatus | undefined;
  nextStatus: IUnifoldExecutionStatus;
}): boolean {
  return previousStatus !== nextStatus && nextStatus === 'succeeded';
}
