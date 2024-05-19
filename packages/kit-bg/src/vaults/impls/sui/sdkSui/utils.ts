import {
  SUI_TYPE_ARG,
  TransactionBlock,
  normalizeSuiAddress,
} from '@mysten/sui.js';

import type { IEncodedTxSui } from '@onekeyhq/core/src/chains/sui/types';
import { OneKeyError } from '@onekeyhq/shared/src/errors';

import type {
  JsonRpcProvider,
  SuiTransactionBlockResponse,
  SuiTransactionBlockResponseOptions,
} from '@mysten/sui.js';

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

const POLL_INTERVAL = 2000;
type IPollFn<T> = (time?: number, index?: number) => T;
export function waitPendingTransaction(
  client: JsonRpcProvider,
  txId: string,
  options?: SuiTransactionBlockResponseOptions,
  right = true,
  retryCount = 10,
): Promise<SuiTransactionBlockResponse | undefined> {
  let retry = 0;

  const poll: IPollFn<
    Promise<SuiTransactionBlockResponse | undefined>
  > = async (time = POLL_INTERVAL) => {
    retry += 1;

    let transaction: SuiTransactionBlockResponse | undefined;
    try {
      transaction = await client.getTransactionBlock({
        digest: txId,
        options: {
          ...options,
          showEffects: true,
        },
      });
    } catch (error: any) {
      if (right) {
        // ignore transaction not found
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        if (error.code !== -32000 && error.code !== -32602) {
          return Promise.reject(new OneKeyError(error));
        }
      }
    }

    const success = transaction?.effects?.status?.status === 'success';

    if (success === true) {
      return Promise.resolve(transaction);
    }

    if (retry > retryCount) {
      return Promise.reject(new OneKeyError('transaction timeout'));
    }

    return new Promise(
      (
        resolve: (p: Promise<SuiTransactionBlockResponse | undefined>) => void,
      ) => setTimeout(() => resolve(poll(time)), time),
    );
  };

  return poll();
}
