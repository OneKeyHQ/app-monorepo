import * as sdk from 'algosdk';

import type { Signer } from '../../../proxy';
import type { IEncodedTxAlgo } from './types';
import type {
  SignedTx,
  UnsignedTx,
} from '@onekeyfe/blockchain-libs/dist/types/provider';

export async function signTransaction(
  unsignedTx: UnsignedTx,
  signer: Signer,
): Promise<SignedTx> {
  const { encodedTx } = unsignedTx.payload as { encodedTx: IEncodedTxAlgo };
  const transaction = sdk.Transaction.from_obj_for_encoding(
    sdk.decodeObj(Buffer.from(encodedTx, 'base64')) as sdk.EncodedTransaction,
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

export function encodeTransaction(tx: sdk.Transaction) {
  return Buffer.from(tx.toByte()).toString('base64');
}
