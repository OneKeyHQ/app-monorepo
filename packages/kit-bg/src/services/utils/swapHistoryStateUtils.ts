import type { ISwapTxHistory } from '@onekeyhq/shared/types/swap/types';

export function getSwapHistoryStateTxIdParam(
  swapTxHistory: Pick<ISwapTxHistory, 'txInfo'>,
) {
  // `/swap/v1/state-tx` requires a txId param. Stock no-send rows do not have a
  // chain txid when local history is created, so the service order id is sent as
  // the transport identity while `orderId` and provider ctx are sent separately.
  return swapTxHistory.txInfo.txId ?? swapTxHistory.txInfo.orderId ?? '';
}
