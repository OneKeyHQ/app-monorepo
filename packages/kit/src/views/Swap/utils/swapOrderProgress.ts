import {
  ESwapCrossChainStatus,
  ESwapTxHistoryStatus,
} from '@onekeyhq/shared/types/swap/types';

export type ISwapOrderProgressStepStatus =
  | 'todo'
  | 'process'
  | 'done'
  | 'error';

export type ISwapOrderProgressStepLabel =
  | 'submitted'
  | 'pending'
  | 'fromChain'
  | 'toChain'
  | 'done'
  | 'failed'
  | 'refund';

export type ISwapOrderProgressStep = {
  label: ISwapOrderProgressStepLabel;
  status: ISwapOrderProgressStepStatus;
};

const successStatuses = new Set<ESwapTxHistoryStatus>([
  ESwapTxHistoryStatus.SUCCESS,
  ESwapTxHistoryStatus.PARTIALLY_FILLED,
]);

const failedStatuses = new Set<ESwapTxHistoryStatus>([
  ESwapTxHistoryStatus.FAILED,
  ESwapTxHistoryStatus.CANCELED,
]);

const processingCrossChainStatuses = new Set<ESwapCrossChainStatus>([
  ESwapCrossChainStatus.FROM_PENDING,
  ESwapCrossChainStatus.FROM_SUCCESS,
  ESwapCrossChainStatus.BRIDGE_PENDING,
  ESwapCrossChainStatus.BRIDGE_SUCCESS,
  ESwapCrossChainStatus.TO_PENDING,
]);

function getThreeStepProgress(
  status?: ESwapTxHistoryStatus,
): ISwapOrderProgressStep[] {
  if (status && successStatuses.has(status)) {
    return [
      { label: 'submitted', status: 'done' },
      { label: 'pending', status: 'done' },
      { label: 'done', status: 'done' },
    ];
  }

  if (status && failedStatuses.has(status)) {
    return [
      { label: 'submitted', status: 'done' },
      { label: 'failed', status: 'error' },
      { label: 'done', status: 'todo' },
    ];
  }

  return [
    { label: 'submitted', status: 'done' },
    { label: 'pending', status: 'process' },
    { label: 'done', status: 'todo' },
  ];
}

function getFourStepSuccessProgress(): ISwapOrderProgressStep[] {
  return [
    { label: 'submitted', status: 'done' },
    { label: 'fromChain', status: 'done' },
    { label: 'toChain', status: 'done' },
    { label: 'done', status: 'done' },
  ];
}

export function getSwapOrderProgressSteps({
  status,
  crossChainStatus,
}: {
  status?: ESwapTxHistoryStatus;
  crossChainStatus?: ESwapCrossChainStatus;
}): ISwapOrderProgressStep[] {
  if (!crossChainStatus) {
    return getThreeStepProgress(status);
  }

  if (
    crossChainStatus === ESwapCrossChainStatus.EXPIRED ||
    crossChainStatus === ESwapCrossChainStatus.PROVIDER_ERROR
  ) {
    return getThreeStepProgress(ESwapTxHistoryStatus.FAILED);
  }

  if (
    crossChainStatus === ESwapCrossChainStatus.REFUNDING ||
    crossChainStatus === ESwapCrossChainStatus.REFUNDED ||
    crossChainStatus === ESwapCrossChainStatus.REFUND_FAILED
  ) {
    let refundStatus: ISwapOrderProgressStepStatus = 'process';
    if (crossChainStatus === ESwapCrossChainStatus.REFUNDED) {
      refundStatus = 'done';
    } else if (crossChainStatus === ESwapCrossChainStatus.REFUND_FAILED) {
      refundStatus = 'error';
    }

    return [
      { label: 'submitted', status: 'done' },
      { label: 'fromChain', status: 'done' },
      { label: 'toChain', status: 'error' },
      { label: 'refund', status: refundStatus },
    ];
  }

  if (
    crossChainStatus === ESwapCrossChainStatus.TO_SUCCESS ||
    (status && successStatuses.has(status))
  ) {
    return getFourStepSuccessProgress();
  }

  if (
    status &&
    failedStatuses.has(status) &&
    processingCrossChainStatuses.has(crossChainStatus)
  ) {
    return getThreeStepProgress(status);
  }

  switch (crossChainStatus) {
    case ESwapCrossChainStatus.FROM_PENDING:
      return [
        { label: 'submitted', status: 'done' },
        { label: 'fromChain', status: 'process' },
        { label: 'toChain', status: 'todo' },
        { label: 'done', status: 'todo' },
      ];
    case ESwapCrossChainStatus.FROM_FAILED:
      return [
        { label: 'submitted', status: 'done' },
        { label: 'fromChain', status: 'error' },
        { label: 'toChain', status: 'todo' },
        { label: 'done', status: 'todo' },
      ];
    case ESwapCrossChainStatus.FROM_SUCCESS:
    case ESwapCrossChainStatus.BRIDGE_PENDING:
    case ESwapCrossChainStatus.BRIDGE_SUCCESS:
    case ESwapCrossChainStatus.TO_PENDING:
      return [
        { label: 'submitted', status: 'done' },
        { label: 'fromChain', status: 'done' },
        { label: 'toChain', status: 'process' },
        { label: 'done', status: 'todo' },
      ];
    case ESwapCrossChainStatus.BRIDGE_FAILED:
    case ESwapCrossChainStatus.TO_FAILED:
      return [
        { label: 'submitted', status: 'done' },
        { label: 'fromChain', status: 'done' },
        { label: 'toChain', status: 'error' },
        { label: 'done', status: 'todo' },
      ];
    default:
      return getThreeStepProgress(status);
  }
}
