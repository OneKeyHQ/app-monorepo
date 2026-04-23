import type {
  IFetchSwapTxHistoryStatusResponse,
  ISwapTxHistory,
} from '@onekeyhq/shared/types/swap/types';
import {
  ESwapCrossChainStatus,
  ESwapTxHistoryStatus,
} from '@onekeyhq/shared/types/swap/types';

const HOUDINI_SWAP_PROVIDER = 'SwapHoudi';

const HOUDINI_SOURCE_TOKEN_SENT_STATE_DETAIL = 'CONFIRMING';
const HOUDINI_REFUNDED_STATE_DETAIL = 'REFUNDED';

const BALANCE_REFRESH_CROSS_CHAIN_STATUSES = new Set<ESwapCrossChainStatus>([
  ESwapCrossChainStatus.FROM_SUCCESS,
  ESwapCrossChainStatus.TO_SUCCESS,
  ESwapCrossChainStatus.REFUNDED,
]);

function isHoudiniSwapProvider(provider?: string) {
  return provider === HOUDINI_SWAP_PROVIDER;
}

function isHoudiniSourceTokenSentStateDetail(stateDetail?: string) {
  return stateDetail === HOUDINI_SOURCE_TOKEN_SENT_STATE_DETAIL;
}

function isHoudiniRefundedStateDetail(stateDetail?: string) {
  return stateDetail === HOUDINI_REFUNDED_STATE_DETAIL;
}

function shouldTrackHoudiniStateDetailChange({
  swapTxHistory,
  txStatusRes,
}: {
  swapTxHistory: ISwapTxHistory;
  txStatusRes: IFetchSwapTxHistoryStatusResponse;
}) {
  return (
    isHoudiniSwapProvider(swapTxHistory.swapInfo.provider.provider) &&
    Boolean(txStatusRes.stateDetail) &&
    txStatusRes.stateDetail !== swapTxHistory.stateDetail
  );
}

export function shouldUpdateSwapHistoryAfterTxState({
  swapTxHistory,
  txStatusRes,
}: {
  swapTxHistory: ISwapTxHistory;
  txStatusRes: IFetchSwapTxHistoryStatusResponse;
}) {
  return (
    txStatusRes.state !== ESwapTxHistoryStatus.PENDING ||
    txStatusRes.crossChainStatus !== swapTxHistory.crossChainStatus ||
    shouldTrackHoudiniStateDetailChange({ swapTxHistory, txStatusRes })
  );
}

export function shouldEmitSwapHistoryBalanceUpdate({
  swapTxHistory,
  txStatusRes,
  previousStateDetail,
}: {
  swapTxHistory: ISwapTxHistory;
  txStatusRes: IFetchSwapTxHistoryStatusResponse;
  previousStateDetail?: string;
}) {
  const finalStateWithoutCrossChainStatus =
    !swapTxHistory.crossChainStatus &&
    (txStatusRes.state === ESwapTxHistoryStatus.SUCCESS ||
      txStatusRes.state === ESwapTxHistoryStatus.PARTIALLY_FILLED);

  const crossChainStatusShouldRefresh = swapTxHistory.crossChainStatus
    ? BALANCE_REFRESH_CROSS_CHAIN_STATUSES.has(swapTxHistory.crossChainStatus)
    : false;

  if (crossChainStatusShouldRefresh || finalStateWithoutCrossChainStatus) {
    return true;
  }

  if (!isHoudiniSwapProvider(swapTxHistory.swapInfo.provider.provider)) {
    return false;
  }

  const nextStateDetail = txStatusRes.stateDetail;
  if (!nextStateDetail || previousStateDetail === nextStateDetail) {
    return false;
  }

  const sourceTokenSentJustDetected =
    !isHoudiniSourceTokenSentStateDetail(previousStateDetail) &&
    isHoudiniSourceTokenSentStateDetail(nextStateDetail);
  const refundJustDetected =
    !isHoudiniRefundedStateDetail(previousStateDetail) &&
    isHoudiniRefundedStateDetail(nextStateDetail);

  return sourceTokenSentJustDetected || refundJustDetected;
}
