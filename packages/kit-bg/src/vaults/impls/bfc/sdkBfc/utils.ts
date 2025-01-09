import { TransactionBlock } from '@benfen/bfc.js/transactions';
import { BFC_TYPE_ARG, normalizeHexAddress } from '@benfen/bfc.js/utils';

import type { IEncodedTxBfc } from '@onekeyhq/core/src/chains/bfc/types';
import { OneKeyError } from '@onekeyhq/shared/src/errors';

import type { OneKeyBfcClient } from './ClientBfc';
import type {
  BenfenTransactionBlockResponse,
  BenfenTransactionBlockResponseOptions,
} from '@benfen/bfc.js/client';

export function normalizeBfcCoinType(coinType: string): string {
  if (coinType !== BFC_TYPE_ARG) {
    const [normalAddress, module, name] = coinType.split('::');
    if (module && name) {
      try {
        return `${normalizeHexAddress(
          normalAddress,
        ).toLowerCase()}::${module}::${name}`;
      } catch {
        // pass
      }
    }
  }
  return coinType;
}

export async function toTransaction(
  client: OneKeyBfcClient,
  sender: string,
  tx: IEncodedTxBfc | Uint8Array,
) {
  let transactionBytes;
  if (tx instanceof Uint8Array) {
    transactionBytes = tx;
  } else {
    const transaction = TransactionBlock.from(tx.rawTx);
    // If the sender has not yet been set on the transaction, then set it.
    // NOTE: This allows for signing transactions with miss matched senders, which is important for sponsored transactions.
    transaction.setSenderIfNotSet(sender);
    transactionBytes = await transaction.build({
      client,
    });
  }

  return transactionBytes;
}

const POLL_INTERVAL = 2000;
type IPollFn<T> = (time?: number, index?: number) => T;
export function waitPendingTransaction(
  client: OneKeyBfcClient,
  txId: string,
  options?: BenfenTransactionBlockResponseOptions,
  right = true,
  retryCount = 10,
): Promise<BenfenTransactionBlockResponse | undefined> {
  let retry = 0;

  const poll: IPollFn<
    Promise<BenfenTransactionBlockResponse | undefined>
  > = async (time = POLL_INTERVAL) => {
    retry += 1;

    let transaction: BenfenTransactionBlockResponse | undefined;
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
        if (error.code !== -32_000 && error.code !== -32_602) {
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
        resolve: (
          p: Promise<BenfenTransactionBlockResponse | undefined>,
        ) => void,
      ) => setTimeout(() => resolve(poll(time)), time),
    );
  };

  return poll();
}

export function objectTypeToCoinType(objectType: string): string {
  if (!objectType) {
    throw new Error('objectType cannot be empty');
  }

  // Handle generic Coin type
  const genericMatch = objectType.match(/0x2::coin::Coin<(.+)>/);
  if (genericMatch) {
    return genericMatch[1];
  }

  return objectType;
}
