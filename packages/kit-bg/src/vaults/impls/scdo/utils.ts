import RLP from 'rlp';
import { keccak256 } from 'viem';

import type { IEncodedTxScdo } from '@onekeyhq/core/src/chains/scdo/types';

export function serializeUnsignedTransaction(tx: IEncodedTxScdo) {
  return RLP.encode([
    tx.From,
    tx.To,
    tx.Amount,
    tx.AccountNonce,
    tx.GasPrice,
    tx.GasLimit,
    tx.Timestamp,
    tx.Payload,
  ]);
}

export function hash(content: Uint8Array | `0x${string}`) {
  return keccak256(content);
}

export function serializeSignedTransaction(
  tx: IEncodedTxScdo,
  txHash: `0x${string}`,
  signature: string,
) {
  return Buffer.from(
    JSON.stringify({
      Data: {
        From: tx.From,
        To: tx.To,
        Amount: tx.Amount,
        AccountNonce: tx.AccountNonce,
        GasPrice: tx.GasPrice,
        GasLimit: tx.GasLimit,
        Timestamp: tx.Timestamp,
        Payload: tx.Payload,
      },
      Hash: txHash,
      Signature: {
        Sig: signature,
      },
    }),
  ).toString('base64');
}
