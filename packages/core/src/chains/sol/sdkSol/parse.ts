import { Transaction, VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';

import type { IEncodedTxSol, INativeTxSol } from '../types';

export function parseToNativeTx(
  encodedTx: IEncodedTxSol,
  encoding: 'base64' | 'bs58' = 'bs58',
): INativeTxSol | null {
  if (!encodedTx) {
    return null;
  }

  let txByte = Buffer.alloc(0);

  if (encoding === 'base64') {
    txByte = Buffer.from(encodedTx, 'base64');
  } else if (encoding === 'bs58') {
    // @ts-ignore
    txByte = bs58.decode(encodedTx);
  }

  try {
    return Transaction.from(txByte);
  } catch (e) {
    return VersionedTransaction.deserialize(txByte);
  }
}
