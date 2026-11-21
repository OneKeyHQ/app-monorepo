import {
  ESwapCrossChainStatus,
  ESwapTxHistoryStatus,
} from '@onekeyhq/shared/types/swap/types';

const SAME_CHAIN_FAILURES = new Set([
  ESwapTxHistoryStatus.FAILED,
  ESwapTxHistoryStatus.CANCELED,
  ESwapTxHistoryStatus.EXPIRED,
]);

export function getEarnSwapSettlement(
  result: {
    state: ESwapTxHistoryStatus;
    crossChainStatus?: ESwapCrossChainStatus;
  },
  isBridge: boolean,
): 'delivered' | 'failed' | 'pending' {
  const { state, crossChainStatus } = result;
  if (state === ESwapTxHistoryStatus.SUCCESS) {
    return !isBridge || crossChainStatus === ESwapCrossChainStatus.TO_SUCCESS
      ? 'delivered'
      : 'pending';
  }
  if (state === ESwapTxHistoryStatus.REFUNDED) return 'failed';
  if (!isBridge) return SAME_CHAIN_FAILURES.has(state) ? 'failed' : 'pending';
  // The source may already have paid when the bridge or destination fails.
  // The existing receipt must stay locked until the source reverts or the refund lands.
  return crossChainStatus === ESwapCrossChainStatus.FROM_FAILED ||
    crossChainStatus === ESwapCrossChainStatus.REFUNDED
    ? 'failed'
    : 'pending';
}
