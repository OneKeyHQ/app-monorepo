import type { ISdkAlgoTransaction } from './sdkAlgo';

export function encodeTransaction(tx: ISdkAlgoTransaction) {
  return Buffer.from(tx.toByte()).toString('base64');
}

export const ALGO_TX_MIN_FEE = '0.001'; // algo
