import {
  AddressLookupTableAccount,
  ComputeBudgetInstruction,
  ComputeBudgetProgram,
  PublicKey,
  Transaction,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import bs58 from 'bs58';

import type {
  IEncodedTxSol,
  INativeTxSol,
} from '@onekeyhq/core/src/chains/sol/types';

import { EParamsEncodings } from './sdkSol/ClientSol';

import type ClientSol from './sdkSol/ClientSol';
import type { TransactionInstruction } from '@solana/web3.js';

export const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
  'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s',
);

export const TOKEN_AUTH_RULES_ID = new PublicKey(
  'auth9SigNpDKz4sJJ1DfCTuZrZNSAgh9sFD3rboVmgg',
);

export const JUPITER_V6_PROGRAM_ID = new PublicKey(
  'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',
);

export const MIN_PRIORITY_FEE = 100000;
export const DEFAULT_COMPUTE_UNIT_LIMIT = 200000;
export const BASE_FEE = 5000; // lamports
export const COMPUTE_UNIT_PRICE_DECIMALS = 6;

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
        const accountInfo = await client.getAccountInfo({
          address: lookup.accountKey.toString(),
          encoding: EParamsEncodings.BASE64,
        });
        if (!accountInfo) {
          throw new Error('Account not found');
        }
        return new AddressLookupTableAccount({
          key: lookup.accountKey,
          state: AddressLookupTableAccount.deserialize(
            Buffer.from(
              accountInfo.data[0],
              accountInfo.data[1] as EParamsEncodings.BASE64,
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

export function parseComputeUnitLimit(instructions: TransactionInstruction[]) {
  let computeUnitLimit = DEFAULT_COMPUTE_UNIT_LIMIT;
  for (const instruction of instructions) {
    if (
      instruction.programId.toString() ===
      ComputeBudgetProgram.programId.toString()
    ) {
      const type = ComputeBudgetInstruction.decodeInstructionType(instruction);
      if (type === 'SetComputeUnitLimit') {
        const { units } =
          ComputeBudgetInstruction.decodeSetComputeUnitLimit(instruction);
        computeUnitLimit = units;
        break;
      }
    }
  }
  return computeUnitLimit;
}

export function parseToNativeTx(
  encodedTx: IEncodedTxSol,
): Promise<INativeTxSol | null> {
  if (!encodedTx) {
    return Promise.resolve(null);
  }

  const txByte = bs58.decode(encodedTx);

  try {
    return Promise.resolve(Transaction.from(txByte));
  } catch (e) {
    return Promise.resolve(VersionedTransaction.deserialize(txByte));
  }
}
