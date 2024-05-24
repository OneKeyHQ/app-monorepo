import {
  AddressLookupTableAccount,
  ComputeBudgetInstruction,
  ComputeBudgetProgram,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import bs58 from 'bs58';

import type { SignedTx, UnsignedTx } from '@onekeyhq/engine/src/types/provider';

import { PARAMS_ENCODINGS } from './sdk/ClientSol';

import type { Signer } from '../../../proxy';
import type { ClientSol } from './sdk/ClientSol';
import type { INativeTxSol } from './types';
import type { TransactionInstruction } from '@solana/web3.js';

export const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
  'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s',
);

export const TOKEN_AUTH_RULES_ID = new PublicKey(
  'auth9SigNpDKz4sJJ1DfCTuZrZNSAgh9sFD3rboVmgg',
);

export const MIN_PRIORITY_FEE = 100000;

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

export async function parseNativeTxDetail({
  nativeTx,
  client,
}: {
  nativeTx: INativeTxSol;
  client: ClientSol;
}): Promise<{
  instructions: TransactionInstruction[];
  message: string;
  addressLookupTableAccounts: AddressLookupTableAccount[];
  versionedTransactionMessage: TransactionMessage | null;
}> {
  let message = '';
  let instructions: TransactionInstruction[] = [];
  let versionedTransactionMessage: TransactionMessage | null = null;
  let addressLookupTableAccounts: AddressLookupTableAccount[] = [];
  const isVersionedTransaction = nativeTx instanceof VersionedTransaction;
  if (isVersionedTransaction) {
    message = Buffer.from(nativeTx.message.serialize()).toString('base64');
    addressLookupTableAccounts = await Promise.all(
      nativeTx.message.addressTableLookups.map(async (lookup) => {
        const accountInfo = await client.getAccountInfo(
          lookup.accountKey.toString(),
          PARAMS_ENCODINGS.BASE64,
        );
        if (!accountInfo) {
          throw new Error('Account not found');
        }
        return new AddressLookupTableAccount({
          key: lookup.accountKey,
          state: AddressLookupTableAccount.deserialize(
            Buffer.from(
              accountInfo.data[0],
              accountInfo.data[1] as PARAMS_ENCODINGS.BASE64,
            ),
          ),
        });
      }),
    );
    versionedTransactionMessage = TransactionMessage.decompile(
      nativeTx.message,
      {
        addressLookupTableAccounts,
      },
    );
    instructions = versionedTransactionMessage.instructions;
  } else {
    message = nativeTx.compileMessage().serialize().toString('base64');
    instructions = nativeTx.instructions;
  }

  return {
    instructions,
    message,
    addressLookupTableAccounts,
    versionedTransactionMessage,
  };
}

export function parseComputeUnitPrice(instructions: TransactionInstruction[]) {
  let computeUnitPrice = '0';
  for (const instruction of instructions) {
    if (
      instruction.programId.toString() ===
      ComputeBudgetProgram.programId.toString()
    ) {
      const type = ComputeBudgetInstruction.decodeInstructionType(instruction);
      if (type === 'SetComputeUnitPrice') {
        const { microLamports } =
          ComputeBudgetInstruction.decodeSetComputeUnitPrice(instruction);
        computeUnitPrice = microLamports.toString();
        break;
      }
    }
  }
  return computeUnitPrice;
}
