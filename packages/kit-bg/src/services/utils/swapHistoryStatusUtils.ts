import { privateSendProvider } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type {
  IFetchSwapTxHistoryStatusResponse,
  ISwapTxHistory,
} from '@onekeyhq/shared/types/swap/types';
import {
  EProtocolOfExchange,
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

const TERMINAL_SWAP_HISTORY_STATUSES = new Set<ESwapTxHistoryStatus>([
  ESwapTxHistoryStatus.SUCCESS,
  ESwapTxHistoryStatus.FAILED,
  ESwapTxHistoryStatus.CANCELED,
  ESwapTxHistoryStatus.PARTIALLY_FILLED,
]);

export function isSwapTxHistoryStatusTerminal(status?: ESwapTxHistoryStatus) {
  return status ? TERMINAL_SWAP_HISTORY_STATUSES.has(status) : false;
}

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

function isPrivateSendHistory(swapTxHistory: ISwapTxHistory) {
  return (
    swapTxHistory.protocol === EProtocolOfExchange.PRIVATE_SEND ||
    swapTxHistory.swapInfo.provider.provider === privateSendProvider
  );
}

function shouldTrackPrivateSendStatusChange({
  swapTxHistory,
  txStatusRes,
}: {
  swapTxHistory: ISwapTxHistory;
  txStatusRes: IFetchSwapTxHistoryStatusResponse;
}) {
  if (!isPrivateSendHistory(swapTxHistory)) {
    return false;
  }

  return (
    (txStatusRes.extraStatus !== undefined &&
      txStatusRes.extraStatus !== swapTxHistory.extraStatus) ||
    (txStatusRes.stateDetail !== undefined &&
      txStatusRes.stateDetail !== swapTxHistory.stateDetail) ||
    (txStatusRes.dealReceiveAmount !== undefined &&
      txStatusRes.dealReceiveAmount !== swapTxHistory.baseInfo.toAmount)
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
    txStatusRes.state !== swapTxHistory.status ||
    txStatusRes.crossChainStatus !== swapTxHistory.crossChainStatus ||
    shouldTrackPrivateSendStatusChange({ swapTxHistory, txStatusRes }) ||
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
