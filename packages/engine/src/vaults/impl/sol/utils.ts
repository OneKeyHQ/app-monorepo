import {
  SignedTx,
  UnsignedTx,
} from '@onekeyfe/blockchain-libs/dist/types/provider';
import { PublicKey, Transaction } from '@solana/web3.js';
import bs58 from 'bs58';

import { Signer } from '../../../proxy';

export async function signTransaction(
  unsignedTx: UnsignedTx,
  signer: Signer,
): Promise<SignedTx> {
  const { nativeTx: transaction, feePayer } = unsignedTx.payload as {
    nativeTx: Transaction;
    feePayer: PublicKey;
  };
  const [sig] = await signer.sign(transaction.serializeMessage());
  transaction.addSignature(feePayer, sig);

  return {
    txid: bs58.encode(sig),
    rawTx: transaction
      .serialize({ requireAllSignatures: false })
      .toString('base64'),
  };
}
