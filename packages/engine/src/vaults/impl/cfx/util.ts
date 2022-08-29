import {
  SignedTx,
  UnsignedTx,
} from '@onekeyfe/blockchain-libs/dist/types/provider';
import { Transaction } from 'js-conflux-sdk';

import { Signer } from '../../../proxy';

export async function signTransaction(
  unsignedTx: UnsignedTx,
  signer: Signer,
): Promise<SignedTx> {
  const privateKey = await signer.getPrvkey();
  const transaction = new Transaction(unsignedTx.payload);
  transaction.sign(
    `0x${privateKey.toString('hex')}`,
    Number(unsignedTx.payload.chainId),
  );
  return {
    txid: transaction.hash,
    rawTx: transaction.serialize(),
  };
}
