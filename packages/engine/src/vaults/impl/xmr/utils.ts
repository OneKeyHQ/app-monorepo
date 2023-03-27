import { IDecodedTxStatus } from '../../types';

import type { IOnChainHistoryTx } from './types';

const TX_MIN_CONFIRMS = 10;

export function getDecodedTxStatus(
  tx: IOnChainHistoryTx,
  blockchainHeight: number,
) {
  if (tx.mempool) {
    return IDecodedTxStatus.Pending;
  }
  if (tx.height === null || tx.height === undefined) {
    return IDecodedTxStatus.Pending;
  }

  return blockchainHeight - tx.height >= TX_MIN_CONFIRMS
    ? IDecodedTxStatus.Confirmed
    : IDecodedTxStatus.Pending;
}
