import { Transaction } from '@mysten/sui/transactions';
import { SUI_TYPE_ARG, normalizeSuiAddress } from '@mysten/sui/utils';

import type { IEncodedTxSui } from '@onekeyhq/core/src/chains/sui/types';
import { OneKeyError } from '@onekeyhq/shared/src/errors';

import type { OneKeySuiClient } from './ClientSui';
import type {
  SuiTransactionBlockResponse,
  SuiTransactionBlockResponseOptions,
} from '@mysten/sui/client';

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

export async function toTransaction(
  client: OneKeySuiClient,
  sender: string,
  tx: IEncodedTxSui | Uint8Array,
) {
  let transactionBytes;
  if (tx instanceof Uint8Array) {
    transactionBytes = tx;
  } else {
    const transaction = Transaction.from(tx.rawTx);
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
  client: OneKeySuiClient,
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
        resolve: (p: Promise<SuiTransactionBlockResponse | undefined>) => void,
      ) => setTimeout(() => resolve(poll(time)), time),
    );
  };

  return poll();
}
