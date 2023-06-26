/* eslint-disable camelcase */
/* eslint-disable @typescript-eslint/naming-convention */
import {
  IntentScope,
  SUI_TYPE_ARG,
  TransactionBlock,
  fromB64,
  messageWithIntent,
  normalizeSuiAddress,
} from '@mysten/sui.js';
import { blake2b } from '@noble/hashes/blake2b';

import type { IEncodedTxSUI } from './types';
import type {
  DryRunTransactionBlockResponse,
  JsonRpcProvider,
} from '@mysten/sui.js';

export const APTOS_SIGN_MESSAGE_PREFIX = 'APTOS';
export const ED25519_PUBLIC_KEY_SIZE = 32;
export const SECP256K1_PUBLIC_KEY_SIZE = 33;

export const DEFAULT_GAS_BUDGET_FOR_PAY = 150;
export const DEFAULT_GAS_BUDGET_FOR_STAKE = 10000;
export const GAS_SAFE_OVERHEAD = 1000;
export const GAS_TYPE_ARG = '0x2::sui::SUI';
export const GAS_SYMBOL = 'SUI';
export const DEFAULT_NFT_TRANSFER_GAS_FEE = 450;
export const SUI_SYSTEM_STATE_OBJECT_ID =
  '0x0000000000000000000000000000000000000005';

export const SUI_NATIVE_COIN = SUI_TYPE_ARG;

/* -------------------------------------------------------------------------- */
/*                              Helper functions                              */

/* -------------------------------------------------------------------------- */

export function handleSignData(txnBytes: Uint8Array, isHardware = false) {
  const serializeTxn = messageWithIntent(IntentScope.TransactionData, txnBytes);
  if (isHardware) {
    return serializeTxn;
  }
  return blake2b(serializeTxn, { dkLen: 32 });
}

export async function toTransaction(
  client: JsonRpcProvider,
  sender: string,
  tx: IEncodedTxSUI | Uint8Array,
) {
  let transactionBlockBytes;
  if (tx instanceof Uint8Array) {
    transactionBlockBytes = tx;
  } else {
    const transactionBlock = TransactionBlock.from(tx.rawTx);
    // If the sender has not yet been set on the transaction, then set it.
    // NOTE: This allows for signing transactions with mis-matched senders, which is important for sponsored transactions.
    transactionBlock.setSenderIfNotSet(sender);
    transactionBlockBytes = await transactionBlock.build({
      provider: client,
    });
  }

  return transactionBlockBytes;
}

export function computeGasBudget(inputSize: number) {
  return DEFAULT_GAS_BUDGET_FOR_PAY * Math.max(2, Math.min(100, inputSize / 2));
}

export const deduplicate = (results: string[] | undefined) =>
  results
    ? results.filter((value, index, self) => self.indexOf(value) === index)
    : [];

export const moveCallTxnName = (moveCallFunctionName?: string): string =>
  moveCallFunctionName ? moveCallFunctionName.replace(/_/g, ' ') : '';

export async function dryRunTransactionBlock(input: {
  provider: JsonRpcProvider;
  sender: string;
  transactionBlock: TransactionBlock | string | Uint8Array;
}): Promise<DryRunTransactionBlockResponse> {
  let dryRunTxBytes: Uint8Array;
  if (TransactionBlock.is(input.transactionBlock)) {
    input.transactionBlock.setSenderIfNotSet(input.sender);
    dryRunTxBytes = await input.transactionBlock.build({
      provider: input.provider,
    });
  } else if (typeof input.transactionBlock === 'string') {
    dryRunTxBytes = fromB64(input.transactionBlock);
  } else if (input.transactionBlock instanceof Uint8Array) {
    dryRunTxBytes = input.transactionBlock;
  } else {
    throw new Error('Unknown transaction format');
  }

  return input.provider.dryRunTransactionBlock({
    transactionBlock: dryRunTxBytes,
  });
}

export function normalizeSuiCoinType(coinType: string): string {
  if (coinType !== SUI_TYPE_ARG) {
    const [normalAddress, module, name] = coinType.split('::');
    if (module && name) {
      try {
        return `${normalizeSuiAddress(
          normalAddress,
        ).toLowerCase()}::${module}::${name}`;
      } catch {
        // pass
      }
    }
  }
  return coinType;
}
