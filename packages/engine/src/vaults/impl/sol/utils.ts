import { VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';

import type { SignedTx, UnsignedTx } from '@onekeyhq/engine/src/types/provider';

import type { Signer } from '../../../proxy';
import type { INativeTxSol } from './types';
import type { PublicKey } from '@solana/web3.js';

export async function signTransaction(
  unsignedTx: UnsignedTx,
  signer: Signer,
): Promise<SignedTx> {
  const { nativeTx: transaction, feePayer } = unsignedTx.payload as {
    nativeTx: INativeTxSol;
    feePayer: PublicKey;
  };

  const isVersionedTransaction = transaction instanceof VersionedTransaction;

  const [sig] = await signer.sign(
    isVersionedTransaction
      ? Buffer.from(transaction.message.serialize())
      : transaction.serializeMessage(),
  );
  transaction.addSignature(feePayer, sig);

  return {
    txid: bs58.encode(sig),
    rawTx: Buffer.from(
      transaction.serialize({ requireAllSignatures: false }),
    ).toString('base64'),
  };
}

export async function signMessage(
  message: string,
  signer: Signer,
): Promise<string> {
  const [signature] = await signer.sign(Buffer.from(message));
  return bs58.encode(signature);
}
