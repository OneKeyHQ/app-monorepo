import type { ISdkAlgoTransaction } from '@onekeyhq/core/src/chains/algo/sdkAlgo';

export function encodeTransaction(tx: ISdkAlgoTransaction) {
  return Buffer.from(tx.toByte()).toString('base64');
}
