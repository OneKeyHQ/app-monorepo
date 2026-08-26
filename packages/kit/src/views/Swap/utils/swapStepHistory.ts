import type { ISwapStep } from '@onekeyhq/shared/types/swap/types';
import {
  ESwapStepStatus,
  ESwapTxHistoryStatus,
} from '@onekeyhq/shared/types/swap/types';

export function reconcileSwapStepWithHistory({
  step,
  historyStatus,
  txId,
}: {
  step: ISwapStep;
  historyStatus: ESwapTxHistoryStatus;
  txId?: string;
}) {
  let status = ESwapStepStatus.PENDING;
  if (historyStatus === ESwapTxHistoryStatus.SUCCESS) {
    status = ESwapStepStatus.SUCCESS;
  } else if (historyStatus === ESwapTxHistoryStatus.FAILED) {
    status = ESwapStepStatus.FAILED;
  }

  return {
    ...step,
    status,
    txHash: txId || step.txHash,
  };
}
