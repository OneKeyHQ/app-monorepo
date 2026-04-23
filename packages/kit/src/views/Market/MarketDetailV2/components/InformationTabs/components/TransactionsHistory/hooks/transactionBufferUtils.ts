import type { IMarketTokenTransaction } from '@onekeyhq/shared/types/marketV2';

export const MAX_BUFFERED_TRANSACTIONS = 100;

export function mergeUniqueTransactions(
  transactions: IMarketTokenTransaction[],
) {
  const seenHashes = new Set<string>();
  return transactions
    .toSorted((a, b) => b.timestamp - a.timestamp)
    .filter((tx) => {
      if (seenHashes.has(tx.hash)) {
        return false;
      }
      seenHashes.add(tx.hash);
      return true;
    });
}

export function appendBufferedTransaction({
  bufferedTransactions,
  currentTransactions,
  transaction,
  maxBufferSize = MAX_BUFFERED_TRANSACTIONS,
}: {
  bufferedTransactions: IMarketTokenTransaction[];
  currentTransactions: IMarketTokenTransaction[];
  transaction: IMarketTokenTransaction;
  maxBufferSize?: number;
}) {
  const isDuplicate =
    bufferedTransactions.some((tx) => tx.hash === transaction.hash) ||
    currentTransactions.some((tx) => tx.hash === transaction.hash);

  if (isDuplicate) {
    return {
      bufferedTransactions,
      isOverflow: false,
    };
  }

  const nextTransactions = [...bufferedTransactions, transaction];
  const isOverflow = nextTransactions.length > maxBufferSize;

  return {
    bufferedTransactions: isOverflow
      ? nextTransactions.slice(nextTransactions.length - maxBufferSize)
      : nextTransactions,
    isOverflow,
  };
}
