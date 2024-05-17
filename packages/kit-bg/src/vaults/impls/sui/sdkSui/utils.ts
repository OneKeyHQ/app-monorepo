import {
  SUI_TYPE_ARG,
  TransactionBlock,
  normalizeSuiAddress,
} from '@mysten/sui.js';

import type { IEncodedTxSui } from '@onekeyhq/core/src/chains/sui/types';

import type { JsonRpcProvider } from '@mysten/sui.js';

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

export const moveCallTxnName = (moveCallFunctionName?: string): string =>
  moveCallFunctionName ? moveCallFunctionName.replace(/_/g, ' ') : '';

export async function toTransaction(
  client: JsonRpcProvider,
  sender: string,
  tx: IEncodedTxSui | Uint8Array,
) {
  let transactionBlockBytes;
  if (tx instanceof Uint8Array) {
    transactionBlockBytes = tx;
  } else {
    const transactionBlock = TransactionBlock.from(tx.rawTx);
    // If the sender has not yet been set on the transaction, then set it.
    // NOTE: This allows for signing transactions with miss matched senders, which is important for sponsored transactions.
    transactionBlock.setSenderIfNotSet(sender);
    transactionBlockBytes = await transactionBlock.build({
      provider: client,
    });
  }

  return transactionBlockBytes;
}
