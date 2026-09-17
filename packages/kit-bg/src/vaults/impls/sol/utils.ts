import {
  AddressLookupTableAccount,
  ComputeBudgetInstruction,
  ComputeBudgetProgram,
  PACKET_DATA_SIZE,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import bs58 from 'bs58';

import {
  METAPLEX_PROGRAM_IDS,
  SPL_PROGRAM_IDS,
  SYSTEM_PROGRAM_IDS,
} from '@onekeyhq/core/src/chains/sol/constants';
import type {
  IEncodedTxSol,
  INativeTxSol,
} from '@onekeyhq/core/src/chains/sol/types';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { EParamsEncodings } from './sdkSol/ClientSol';

import type ClientSol from './sdkSol/ClientSol';
import type { TransactionInstruction } from '@solana/web3.js';

export const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
  'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s',
);

export const TOKEN_AUTH_RULES_ID = new PublicKey(
  'auth9SigNpDKz4sJJ1DfCTuZrZNSAgh9sFD3rboVmgg',
);

export const MIN_PRIORITY_FEE = 100_000;
export const DEFAULT_COMPUTE_UNIT_LIMIT = 200_000;
export const BASE_FEE = 5000; // lamports
export const COMPUTE_UNIT_PRICE_DECIMALS = 6;

export const CREATE_TOKEN_ACCOUNT_RENT = '0.00203928'; // sol

export function isTxOverSize(encodedTx: string): boolean {
  const txBytes = bs58.decode(encodedTx);
  return txBytes.length > PACKET_DATA_SIZE;
}

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
          throw new OneKeyLocalError('Account not found');
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

export function isSystemBuiltinProgram(pid: string) {
  return SYSTEM_PROGRAM_IDS.has(pid);
}

export function isSplProgram(pid: string) {
  return SPL_PROGRAM_IDS.has(pid);
}

export function isMetaplexProgram(pid: string) {
  return METAPLEX_PROGRAM_IDS.has(pid);
}

export function isCustomProgram(pid: string) {
  return !(
    isSystemBuiltinProgram(pid) ||
    isSplProgram(pid) ||
    isMetaplexProgram(pid)
  );
}

// System program instruction index of AdvanceNonceAccount (u32 LE prefix).
const ADVANCE_NONCE_ACCOUNT_INSTRUCTION_INDEX = 4;

function isAdvanceNonceInstruction({
  programId,
  data,
}: {
  programId: PublicKey;
  data: Uint8Array;
}): boolean {
  return (
    programId.equals(SystemProgram.programId) &&
    data.length >= 4 &&
    Buffer.from(data).readUInt32LE(0) ===
      ADVANCE_NONCE_ACCOUNT_INSTRUCTION_INDEX
  );
}

// A durable-nonce tx carries the nonce value in `recentBlockhash`; by
// convention its first instruction is AdvanceNonceAccount.
export function isDurableNonceSolTx(nativeTx: INativeTxSol): boolean {
  if (nativeTx instanceof VersionedTransaction) {
    const { message } = nativeTx;
    const firstInstruction = message.compiledInstructions[0];
    const programId = firstInstruction
      ? message.staticAccountKeys[firstInstruction.programIdIndex]
      : undefined;
    return Boolean(
      firstInstruction &&
      programId &&
      isAdvanceNonceInstruction({
        programId,
        data: firstInstruction.data,
      }),
    );
  }
  if (nativeTx.nonceInfo) {
    return true;
  }
  const firstInstruction = nativeTx.instructions[0];
  return Boolean(
    firstInstruction && isAdvanceNonceInstruction(firstInstruction),
  );
}

// Re-stamping the blockhash invalidates every existing signature, so only a
// tx the wallet alone signs (no co-signer, no durable nonce) may be refreshed.
export function canRefreshSolTxBlockhash(nativeTx: INativeTxSol): boolean {
  if (nativeTx.signatures.length > 1) {
    return false;
  }
  return !isDurableNonceSolTx(nativeTx);
}

export function serializeSolTx(nativeTx: INativeTxSol): IEncodedTxSol {
  if (nativeTx instanceof VersionedTransaction) {
    return bs58.encode(Buffer.from(nativeTx.serialize()));
  }
  return bs58.encode(nativeTx.serialize({ requireAllSignatures: false }));
}

export function replaceSolTxRecentBlockhash({
  nativeTx,
  recentBlockhash,
  lastValidBlockHeight,
}: {
  nativeTx: INativeTxSol;
  recentBlockhash: string;
  lastValidBlockHeight?: number;
}): IEncodedTxSol {
  if (nativeTx instanceof Transaction) {
    nativeTx.recentBlockhash = recentBlockhash;
    nativeTx.lastValidBlockHeight = lastValidBlockHeight;
  } else {
    nativeTx.message.recentBlockhash = recentBlockhash;
  }
  return serializeSolTx(nativeTx);
}
