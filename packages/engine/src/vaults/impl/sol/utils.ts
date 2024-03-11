import { PublicKey, VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';

import type { SignedTx, UnsignedTx } from '@onekeyhq/engine/src/types/provider';

import type { Signer } from '../../../proxy';
import type { INativeTxSol } from './types';

export const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
  'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s',
);

export const TOKEN_AUTH_RULES_ID = new PublicKey(
  'auth9SigNpDKz4sJJ1DfCTuZrZNSAgh9sFD3rboVmgg',
);

export const MIN_PRIORITY_FEE = 1000;

export function metadataAddress(mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from('metadata'),
      TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ],
    TOKEN_METADATA_PROGRAM_ID,
  )[0];
}

export function tokenRecordAddress(
  mint: PublicKey,
  token: PublicKey,
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from('metadata'),
      TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
      Buffer.from('token_record'),
      token.toBuffer(),
    ],
    TOKEN_METADATA_PROGRAM_ID,
  )[0];
}

export function masterEditionAddress(mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from('metadata'),
      TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
      Buffer.from('edition'),
    ],
    TOKEN_METADATA_PROGRAM_ID,
  )[0];
}

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
