import type { ISdkAlgoTransaction } from './sdkAlgo';

export function encodeTransaction(tx: ISdkAlgoTransaction) {
  return Buffer.from(tx.toByte()).toString('base64');
}
