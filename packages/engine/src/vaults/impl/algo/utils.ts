import type { SignedTx } from '@onekeyhq/engine/src/types/provider';

import sdk from './sdkAlgo';

import type { Signer } from '../../../proxy';
import type {
  ISdkAlgoEncodedTransaction,
  ISdkAlgoTransaction,
} from './sdkAlgo';
import type { IEncodedTxAlgo } from './types';

export async function signTransaction(
  encodedTx: IEncodedTxAlgo,
  signer: Signer,
): Promise<SignedTx> {
  const transaction = sdk.Transaction.from_obj_for_encoding(
    sdk.decodeObj(
      Buffer.from(encodedTx, 'base64'),
    ) as ISdkAlgoEncodedTransaction,
  );
  const [signature] = await signer.sign(transaction.bytesToSign());

  return {
    txid: transaction.txID(),
    rawTx: Buffer.from(
      sdk.encodeObj({
        sig: signature,
        txn: transaction.get_obj_for_encoding(),
      }),
    ).toString('base64'),
  };
}

export function encodeTransaction(tx: ISdkAlgoTransaction) {
  return Buffer.from(tx.toByte()).toString('base64');
}
